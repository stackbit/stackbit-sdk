import path from 'path';
import fse from 'fs-extra';
import _ from 'lodash';
import micromatch from 'micromatch';
import { Octokit } from '@octokit/rest';
import { readDirRecursively, parseDataByFilePath, reducePromise } from '@stackbit/utils';

import { DATA_FILE_EXTENSIONS, MARKDOWN_FILE_EXTENSIONS } from '../consts';

export const EXCLUDED_LIST_FILES = ['**/node_modules/**', '**/.git/**', '.idea/**'];

export interface FileResult {
    filePath: string;
    isFile: boolean;
    isDirectory: boolean;
}

export interface ListFilesOptions {
    includePattern?: string | string[];
    excludePattern?: string | string[];
}

export interface FileBrowserAdapterInterface {
    listFiles(listFilesOptions: ListFilesOptions): Promise<FileResult[]>;
    readFile(filePath: string): Promise<string>;
}

export interface FileSystemFileBrowserAdapterOptions {
    dirPath: string;
}

export class FileSystemFileBrowserAdapter implements FileBrowserAdapterInterface {
    private readonly dirPath: string;

    constructor({ dirPath }: FileSystemFileBrowserAdapterOptions) {
        this.dirPath = dirPath;
    }

    async listFiles({ includePattern, excludePattern }: ListFilesOptions): Promise<FileResult[]> {
        const readDirResult = await readDirRecursively(this.dirPath, {
            includeDirs: true,
            includeStats: true,
            filter: (filePath) => {
                const isIncluded = !includePattern || micromatch.isMatch(filePath, includePattern);
                excludePattern = excludePattern || EXCLUDED_LIST_FILES;
                const isExcluded = micromatch.isMatch(filePath, excludePattern);
                return isIncluded && !isExcluded;
            }
        });
        // TODO: order files alphabetically so both Git and FileSystem adapters will result same analyze results
        return readDirResult.map((fileResult) => ({
            filePath: fileResult.filePath,
            isFile: fileResult.stats.isFile(),
            isDirectory: fileResult.stats.isDirectory()
        }));
    }

    async readFile(filePath: string): Promise<string> {
        const absPath = path.join(this.dirPath, filePath);
        return fse.readFile(absPath, 'utf8');
    }
}

export interface GitHubFileBrowserAdapterBaseOptions {
    branch: string;
    auth?: string;
}

export interface GitHubFileBrowserAdapterOwnerRepoOptions {
    owner: string;
    repo: string;
}

export interface GitHubFileBrowserAdapterRepoUrlOptions {
    repoUrl: string;
}

export type GitHubFileBrowserAdapterOptions = GitHubFileBrowserAdapterBaseOptions &
    (GitHubFileBrowserAdapterRepoUrlOptions | GitHubFileBrowserAdapterOwnerRepoOptions);

interface OctokitTreeNode {
    path?: string;
    mode?: string;
    type?: string;
    sha?: string;
    size?: number;
    url?: string;
}

export class GitHubFileBrowserAdapter implements FileBrowserAdapterInterface {
    private readonly octokit: Octokit;
    private readonly owner: string;
    private readonly repo: string;
    private readonly branch: string;

    constructor(options: GitHubFileBrowserAdapterBaseOptions & GitHubFileBrowserAdapterRepoUrlOptions);
    constructor(options: GitHubFileBrowserAdapterBaseOptions & GitHubFileBrowserAdapterOwnerRepoOptions);
    constructor(options: GitHubFileBrowserAdapterOptions) {
        if ('repoUrl' in options) {
            const parsedRepoUrl = this.parseGitHubUrl(options.repoUrl);
            if (!parsedRepoUrl) {
                throw new Error(`repository URL '${options.repoUrl}' cannot be parsed, please use standard github URL`);
            }
            this.owner = parsedRepoUrl.owner;
            this.repo = parsedRepoUrl.repo;
        } else {
            this.owner = options.owner;
            this.repo = options.repo;
        }
        this.branch = options.branch;
        this.octokit = new Octokit({
            auth: options.auth
        });
    }

    async listFiles(listFilesOptions: ListFilesOptions): Promise<FileResult[]> {
        // const branchResponse = await this.octokit.repos.getBranch({
        //     owner: this.owner,
        //     repo: this.repo,
        //     branch: this.branch
        // });
        // const treeSha = branchResponse.data.commit.commit.tree.sha;
        const branchResponse = await this.octokit.repos.listBranches({
            owner: this.owner,
            repo: this.repo
        });
        const branch = _.find(branchResponse.data, { name: this.branch });
        if (!branch) {
            throw new Error(`branch ${this.branch} not found`);
        }
        const treeSha = branch.commit.sha;
        const treeResponse = await this.octokit.git.getTree({
            owner: this.owner,
            repo: this.repo,
            tree_sha: treeSha,
            recursive: 'true'
        });
        let tree;
        if (!treeResponse.data.truncated) {
            const { includePattern, excludePattern } = listFilesOptions;
            tree = treeResponse.data.tree;
            tree = tree.filter((node) => {
                if (!node.path || !(node.type === 'blob' || node.type === 'tree')) {
                    return false;
                }
                const isIncluded = !includePattern || micromatch.isMatch(node.path, includePattern);
                const isExcluded = micromatch.isMatch(node.path, excludePattern || EXCLUDED_LIST_FILES);
                return isIncluded && !isExcluded;
            });
        } else {
            tree = await this.listFilesRecursively(treeResponse.data.sha, listFilesOptions, '');
        }
        // TODO: order files alphabetically so both Git and FileSystem adapters will result same analyze results
        return tree.map((node) => ({
            filePath: node.path!,
            isFile: node.type === 'blob',
            isDirectory: node.type === 'tree'
        }));
    }

    async listFilesRecursively(treeSha: string, listFilesOptions: ListFilesOptions, parentPath: string): Promise<OctokitTreeNode[]> {
        const treeResponse = await this.octokit.git.getTree({
            owner: this.owner,
            repo: this.repo,
            tree_sha: treeSha
        });
        const { includePattern, excludePattern } = listFilesOptions;
        const { blob: files, tree: folders } = _.groupBy(treeResponse.data.tree, 'type');
        const filter = (fullPath: string) => {
            const isIncluded = !includePattern || micromatch.isMatch(fullPath, includePattern);
            const isExcluded = micromatch.isMatch(fullPath, excludePattern || EXCLUDED_LIST_FILES);
            return isIncluded && !isExcluded;
        };
        const filteredFolders = (folders || []).reduce((accum: OctokitTreeNode[], treeNode) => {
            if (!treeNode.path || !treeNode.sha) {
                return accum;
            }
            const fullPath = (parentPath ? parentPath + '/' : '') + treeNode.path;
            if (!filter(fullPath)) {
                return accum;
            }
            return accum.concat(Object.assign(treeNode, { path: fullPath }));
        }, []);
        const filteredFiles = (files || []).reduce((accum: OctokitTreeNode[], fileNode) => {
            if (!fileNode.path) {
                return accum;
            }
            const fullPath = (parentPath ? parentPath + '/' : '') + fileNode.path;
            if (!filter(fullPath)) {
                return accum;
            }
            return accum.concat(Object.assign(fileNode, { path: fullPath }));
        }, []);
        const folderResults = await reducePromise(
            filteredFolders,
            async (accum: OctokitTreeNode[], treeNode) => {
                const results = await this.listFilesRecursively(treeNode.sha!, listFilesOptions, treeNode.path!);
                return accum.concat(treeNode, results);
            },
            []
        );
        return folderResults.concat(filteredFiles);
    }

    async readFile(filePath: string): Promise<string> {
        const contentResponse = await this.octokit.repos.getContent({
            owner: this.owner,
            repo: this.repo,
            path: filePath
        });
        if ('content' in contentResponse.data) {
            const base64Content = contentResponse.data.content;
            return Buffer.from(base64Content, 'base64').toString();
        }
        return '';
    }

    parseGitHubUrl(repoUrl: string): GitHubFileBrowserAdapterOwnerRepoOptions | null {
        const match = repoUrl.match(/github\.com[/:](.+?)\/(.+?)(\.git)?$/);
        if (!match) {
            return null;
        }
        const owner = match[1]!;
        const repo = match[2]!;
        return { owner, repo };
    }
}

export type GetFileBrowserOptions = { fileBrowser: FileBrowser } | { fileBrowserAdapter: FileBrowserAdapterInterface };
export function getFileBrowserFromOptions(options: GetFileBrowserOptions): FileBrowser {
    if ('fileBrowser' in options) {
        return options.fileBrowser;
    }
    if (!('fileBrowserAdapter' in options)) {
        throw new Error('either fileBrowser or fileBrowserAdapter must be provided to SSG matcher');
    }
    return new FileBrowser({ fileBrowserAdapter: options.fileBrowserAdapter });
}

export interface FileBrowserOptions {
    fileBrowserAdapter: FileBrowserAdapterInterface;
}

interface TreeNode {
    [key: string]: true | TreeNode;
}

export class FileBrowser {
    private readonly fileBrowserAdapter: FileBrowserAdapterInterface;
    private readonly filePathMap: Record<string, boolean>;
    private readonly directoryPathsMap: Record<string, boolean>;
    private readonly filePathsByFileName: Record<string, string[]>;
    private readonly fileData: Record<string, any>;
    private readonly filePaths: string[];
    private readonly fileTree: TreeNode;
    private files: FileResult[] = [];

    constructor({ fileBrowserAdapter }: FileBrowserOptions) {
        this.fileBrowserAdapter = fileBrowserAdapter;
        this.filePaths = [];
        this.filePathMap = {};
        this.directoryPathsMap = {};
        this.filePathsByFileName = {};
        this.fileTree = {};
        this.fileData = {};
    }

    async listFiles({ includePattern, excludePattern }: { includePattern?: string | string[]; excludePattern?: string | string[] } = {}) {
        if (this.files.length > 0) {
            return;
        }

        this.files = await this.fileBrowserAdapter.listFiles({ includePattern, excludePattern });
        // create maps to find files by names or paths quickly
        _.forEach(this.files, (fileReadResult) => {
            const filePath = fileReadResult.filePath;
            const filePathArr = filePath.split(path.sep);
            if (fileReadResult.isFile) {
                _.set(this.fileTree, filePathArr, true);
                const pathObject = path.parse(filePath);
                const fileName = pathObject.base;
                if (!(fileName in this.filePathsByFileName)) {
                    this.filePathsByFileName[fileName] = [];
                }
                this.filePathsByFileName[fileName]!.push(filePath);
                this.filePaths.push(filePath);
                this.filePathMap[filePath] = true;
            } else if (fileReadResult.isDirectory) {
                if (!_.has(this.fileTree, filePathArr)) {
                    _.set(this.fileTree, filePathArr, {});
                }
                this.directoryPathsMap[filePath] = true;
            }
        });
    }

    filePathExists(filePath: string) {
        return _.has(this.filePathMap, filePath);
    }

    fileNameExists(fileName: string) {
        return _.has(this.filePathsByFileName, fileName);
    }

    getFilePathsForFileName(fileName: string): string[] {
        return _.get(this.filePathsByFileName, fileName, []);
    }

    directoryPathExists(dirPath: string) {
        return _.has(this.directoryPathsMap, dirPath);
    }

    findFiles(pattern: string | string[]) {
        return micromatch(this.filePaths, pattern);
    }

    readFilesRecursively(dirPath: string, { filter, includeDirs }: { filter?: (fileResult: FileResult) => boolean; includeDirs?: boolean }): string[] {
        const reduceTreeNode = (treeNode: TreeNode, parentPath: string) => {
            return _.reduce(
                treeNode,
                (result: string[], value, name) => {
                    const filePath = path.join(parentPath, name);
                    const isFile = value === true;
                    if (filter && !filter({ filePath, isFile: isFile, isDirectory: !isFile })) {
                        return result;
                    }
                    if (value !== true) {
                        const childFilePaths = reduceTreeNode(value, filePath);
                        result = includeDirs ? result.concat(filePath, childFilePaths) : result.concat(childFilePaths);
                    } else {
                        result = result.concat(filePath);
                    }
                    return result;
                },
                []
            );
        };
        const treeNode = dirPath === '' ? this.fileTree : _.get(this.fileTree, dirPath.split(path.sep));
        return reduceTreeNode(treeNode, '');
    }

    async getFileData(filePath: string): Promise<any> {
        if (!this.filePathExists(filePath)) {
            return null;
        }
        if (!(filePath in this.fileData)) {
            const extension = path.extname(filePath).substring(1);
            const data = await this.fileBrowserAdapter.readFile(filePath);
            if ([...DATA_FILE_EXTENSIONS, ...MARKDOWN_FILE_EXTENSIONS].includes(extension)) {
                try {
                    this.fileData[filePath] = parseDataByFilePath(data, filePath);
                } catch (error) {
                    console.warn(`error parsing file: ${filePath}`);
                    this.fileData[filePath] = null;
                }
            } else {
                this.fileData[filePath] = data;
            }
        }
        return this.fileData[filePath];
    }
}
