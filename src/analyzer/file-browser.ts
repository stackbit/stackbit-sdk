import path from 'path';
import fse from 'fs-extra';
import _ from 'lodash';
import micromatch from 'micromatch';
import { Octokit } from '@octokit/rest';
import { readDirRecursively, parseDataByFilePath, reducePromise } from '@stackbit/utils';

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
                excludePattern = excludePattern || ['**/node_modules', '.git', '.idea'];
                const isExcluded = micromatch.isMatch(filePath, excludePattern);
                return isIncluded && !isExcluded;
            }
        });
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

export interface GitHubFileBrowserAdapterOptions {
    owner: string;
    repo: string;
    branch: string;
    auth?: string;
}

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

    constructor({ owner, repo, branch, auth }: GitHubFileBrowserAdapterOptions) {
        this.owner = owner;
        this.repo = repo;
        this.branch = branch;
        this.octokit = new Octokit({
            auth: auth
        });
    }

    async listFiles(listFilesOptions: ListFilesOptions): Promise<FileResult[]> {
        const branchResponse = await this.octokit.repos.getBranch({
            owner: this.owner,
            repo: this.repo,
            branch: this.branch
        });
        const treeSha = branchResponse.data.commit.commit.tree.sha;
        const treeResponse = await this.octokit.git.getTree({
            owner: this.owner,
            repo: this.repo,
            tree_sha: treeSha,
            recursive: 'true'
        });
        let tree;
        if (!treeResponse.data.truncated) {
            tree = treeResponse.data.tree;
        } else {
            tree = await this.listFilesRecursively(treeResponse.data.sha);
        }
        return tree
            .filter((node) => node.path && (node.type === 'blob' || node.type === 'tree'))
            .map((node) => ({
                filePath: node.path!,
                isFile: node.type === 'blob',
                isDirectory: node.type === 'tree'
            }));
    }

    async listFilesRecursively(treeSha: string): Promise<OctokitTreeNode[]> {
        const treeResponse = await this.octokit.git.getTree({
            owner: this.owner,
            repo: this.repo,
            tree_sha: treeSha
        });
        const { blob: files, tree: folders } = _.groupBy(treeResponse.data.tree, 'type');
        const filteredFolders = (folders || []).filter((treeNode) => treeNode.path && treeNode.sha);
        const folderResults = await reducePromise(
            filteredFolders,
            async (accum: OctokitTreeNode[], treeNode) => {
                const results = await this.listFilesRecursively(treeNode.sha!);
                return accum.concat(
                    treeNode,
                    results.map((node) => {
                        return {
                            ...node,
                            path: treeNode.path + '/' + node.path
                        };
                    })
                );
            },
            []
        );
        const fileResults = files || [];
        return folderResults.concat(fileResults);
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
}

export class FileBrowser {
    private readonly fileBrowserAdapter: FileBrowserAdapterInterface;
    private readonly filePathMap: Record<string, boolean>;
    private readonly directoryPathsMap: Record<string, boolean>;
    private readonly filePathsByFileName: Record<string, string[]>;
    private readonly fileData: Record<string, any>;
    private readonly filePaths: string[];
    private files: FileResult[] = [];

    constructor({ fileBrowserAdapter }: { fileBrowserAdapter: FileBrowserAdapterInterface }) {
        this.fileBrowserAdapter = fileBrowserAdapter;
        this.filePaths = [];
        this.filePathMap = {};
        this.directoryPathsMap = {};
        this.filePathsByFileName = {};
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
            if (fileReadResult.isFile) {
                const pathObject = path.parse(filePath);
                const fileName = pathObject.base;
                if (!(fileName in this.filePathsByFileName)) {
                    this.filePathsByFileName[fileName] = [];
                }
                this.filePathsByFileName[fileName]!.push(filePath);
                this.filePaths.push(filePath);
                this.filePathMap[filePath] = true;
            } else if (fileReadResult.isDirectory) {
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

    getFilePathsForFileName(fileName: string) {
        return _.get(this.filePathsByFileName, fileName);
    }

    directoryPathExists(dirPath: string) {
        return _.has(this.directoryPathsMap, dirPath);
    }

    findFiles(pattern: string | string[]) {
        return micromatch(this.filePaths, pattern);
    }

    async getFileData(filePath: string) {
        if (!this.filePathExists(filePath)) {
            return null;
        }
        if (!(filePath in this.fileData)) {
            const extension = path.extname(filePath).substring(1);
            const data = await this.fileBrowserAdapter.readFile(filePath);
            if (['yml', 'yaml', 'json', 'toml', 'md', 'mdx', 'markdown'].includes(extension)) {
                this.fileData[filePath] = parseDataByFilePath(data, filePath);
            } else {
                this.fileData[filePath] = data;
            }
        }
        return this.fileData[filePath];
    }
}
