import _ from 'lodash';
import fse from 'fs-extra';
import path from 'path';
import micromatch from 'micromatch';
import { parseFile, readDirRecursively, forEachPromise, findPromise } from '@stackbit/utils';
import { getModelsByQuery } from '@stackbit/schema';

import { ConfigModel, Model, Config } from '../config/config-loader';
import { FileNotMatchedModel, FileMatchedMultipleModels, FileReadError, FileForModelNotFound, FolderReadError } from './content-errors';
import { isConfigModel, isDataModel, isPageModel } from '../schema-utils';
import { validate } from './content-validator';

interface BaseMetadata {
    filePath: string;
}

interface ModeledMetadata extends BaseMetadata {
    modelName: string;
}

interface UnmodeledMetadata extends BaseMetadata {
    modelName: null;
}

type Metadata = ModeledMetadata | UnmodeledMetadata;

export interface ContentItem {
    [index: string]: any;
    __metadata: Metadata;
}

/*
interface BaseContentItem {
    filePath: string;
    data: any;
}

interface ModeledContentItem extends BaseContentItem {
    modelName: string;
}

interface UnmodeledContentItem extends BaseContentItem {
    modelName: null;
}

type ContentItem = ModeledContentItem | UnmodeledContentItem;
*/

interface LoadContentOptions {
    dirPath: string;
    config: Config;
    skipUnmodeledContent: boolean;
}

export async function loadContent({ dirPath, config, skipUnmodeledContent }: LoadContentOptions) {
    const { contentItems: dataItems, errors: dataErrors } = await loadDataFiles({ dirPath, config, skipUnmodeledContent });
    const { contentItems: pageItems, errors: pageErrors } = await loadPageFiles({ dirPath, config, skipUnmodeledContent });
    const contentItems = _.concat(dataItems, pageItems);
    const validationResult = validate({ contentItems, config });
    return {
        contentItems: validationResult.value,
        errors: _.concat(dataErrors, pageErrors, validationResult.errors)
    };
}

async function loadDataFiles({ dirPath, config, skipUnmodeledContent }: LoadContentOptions) {
    const contentItems: ContentItem[] = [];
    const errors: Error[] = [];

    // 'config' is a deprecated model type used to describe the models of
    // ssg-specific configuration files e.g., _config.yml for Jekyll and
    // config.toml for Hugo.
    const configModel = config.models.find(isConfigModel);
    let configFilePath: string | undefined;
    if (configModel) {
        const result = await loadDataItemForConfigModel(dirPath, configModel, config);
        if (result.contentItem) {
            configFilePath = result.contentItem.__metadata.filePath;
            contentItems.push(result.contentItem);
        }
        if (result.error) {
            errors.push(result.error);
        }
    }

    // if user specifically set dataDir to null, opt-out from loading data files all-together
    if (config.dataDir === null) {
        return { contentItems, errors };
    }

    // if dataDir was not set, assume empty string as root folder
    const dataDir = config.dataDir || '';
    const absDataDirPath = path.join(dirPath, dataDir);
    const excludedFiles = ['**/node_modules/**'];
    const allowedExtensions = ['yml', 'yaml', 'toml', 'json'];
    const dataModels = config.models.filter(isDataModel);

    if (dataDir === '') {
        const rootExcludedFiles = ['stackbit.yaml', 'netlify.toml', 'theme.toml', 'package.json', 'package-lock.json', 'yarn-lock.json'];
        excludedFiles.push(...rootExcludedFiles);
        if (configFilePath) {
            excludedFiles.push(configFilePath);
        }
        if (config.publishDir) {
            excludedFiles.push(config.publishDir);
        }
    }

    let filePaths;
    try {
        filePaths = await readDirRecursivelyWithFilter(absDataDirPath, excludedFiles, allowedExtensions);
    } catch (error) {
        return {
            contentItems,
            errors: errors.concat(new FolderReadError({ folderPath: dataDir, error: error }))
        };
    }

    const result = await loadContentItems({
        projectDir: dirPath,
        contentDir: dataDir,
        filePaths,
        models: dataModels,
        objectTypeKeyPath: 'type',
        modelTypeKeyPath: 'name',
        skipUnmodeledContent
    });
    contentItems.push(...result.contentItems);
    errors.push(...result.errors);

    return { contentItems, errors };
}

async function loadPageFiles({ dirPath, config, skipUnmodeledContent }: LoadContentOptions) {
    const contentItems: ContentItem[] = [];
    const errors: Error[] = [];

    // if user specifically set pagesDir to null, opt-out from loading page files all-together
    if (config.pagesDir === null) {
        return { contentItems, errors };
    }

    // if pagesDir was not set, assume empty string as root folder
    const pagesDir = config.pagesDir || '';
    const pageLayoutKey = config.pageLayoutKey;
    const absPagesDirPath = path.join(dirPath, pagesDir);
    const excludedFiles = _.castArray(config.excludePages || []).concat(['**/node_modules/**']);
    const allowedExtensions = ['md', 'mdx', 'markdown'];
    const pageModels = config.models.filter(isPageModel);

    if (pagesDir === '') {
        const rootExcludedFiles = ['LICENSE.md', 'README.md', 'README.theme.md', 'CONTRIBUTING.md', 'CHANGELOG.md'];
        excludedFiles.push(...rootExcludedFiles);
        if (config.publishDir) {
            excludedFiles.push(config.publishDir);
        }
    }

    let filePaths;
    try {
        filePaths = await readDirRecursivelyWithFilter(absPagesDirPath, excludedFiles, allowedExtensions);
    } catch (error) {
        return {
            contentItems,
            errors: errors.concat(new FolderReadError({ folderPath: pagesDir, error: error }))
        };
    }
    const result = await loadContentItems({
        projectDir: dirPath,
        contentDir: pagesDir,
        filePaths,
        models: pageModels,
        objectTypeKeyPath: pageLayoutKey ? pageLayoutKey : null,
        modelTypeKeyPath: 'layout',
        skipUnmodeledContent
    });
    contentItems.push(...result.contentItems);
    errors.push(...result.errors);

    return { contentItems, errors };
}

async function loadDataItemForConfigModel(dirPath: string, configModel: ConfigModel, config: Config) {
    let filePath;
    if ('file' in configModel) {
        filePath = configModel.file;
    } else {
        filePath = await inferConfigFileFromSSGName(config, dirPath);
    }
    if (!filePath) {
        return {
            error: new FileForModelNotFound({ modelName: configModel.name })
        };
    }
    const extension = path.extname(filePath).substring(1);
    const allowedExtensions = ['yml', 'yaml', 'toml', 'json'];
    if (!allowedExtensions.includes(extension)) {
        return {
            error: new FileReadError({ filePath: filePath, error: new Error(`extension '${extension}' is not supported`) })
        };
    }

    const absFilePath = path.join(dirPath, filePath);
    const fileExists = await fse.pathExists(absFilePath);
    if (!fileExists) {
        return {};
    }
    try {
        const data = await loadFile(absFilePath);
        return {
            contentItem: modeledDataItem(filePath, configModel, data)
        };
    } catch (error) {
        return {
            error: new FileReadError({ filePath: filePath, error: error })
        };
    }
}

async function readDirRecursivelyWithFilter(dirPath: string, excludedFiles: string[], allowedExtensions: string[]) {
    return readDirRecursively(dirPath, {
        filter: (filePath, stats) => {
            if (micromatch.isMatch(filePath, excludedFiles)) {
                return false;
            }
            if (!stats.isFile()) {
                return true;
            }
            const extension = path.extname(filePath).substring(1);
            return allowedExtensions.includes(extension);
        }
    });
}

interface LoadContentItemsOptions {
    projectDir: string;
    contentDir: string;
    filePaths: string[];
    models: Model[];
    objectTypeKeyPath?: string | string[] | null;
    modelTypeKeyPath?: string | string[];
    skipUnmodeledContent: boolean;
}

/**
 * Loads files from the provided `filePaths` relative to the directory produced by
 * joining the `projectDir` and `contentDir`.
 *
 * @param options
 * @param options.projectDir Absolute path of project directory
 * @param options.contentDir Directory within project directory from where to load files
 * @param options.filePaths Array of file paths to load, files paths must be relative to contentDir
 * @param options.models Array of models
 * @param options.objectTypeKeyPath The key path of object field to match a model
 * @param options.modelTypeKeyPath The key path of model property to match an object
 * @param options.skipUnmodeledContent Don't return un-modeled data
 */
async function loadContentItems({
    projectDir,
    contentDir,
    filePaths,
    models,
    objectTypeKeyPath,
    modelTypeKeyPath,
    skipUnmodeledContent
}: LoadContentItemsOptions) {
    const absContentDir = path.join(projectDir, contentDir);
    const contentItems: ContentItem[] = [];
    const errors: Error[] = [];
    await forEachPromise(filePaths, async (filePath) => {
        const absFilePath = path.join(absContentDir, filePath);
        const filePathRelativeToProject = path.join(contentDir, filePath);
        let data;
        try {
            data = await loadFile(absFilePath);
        } catch (error) {
            errors.push(new FileReadError({ filePath: filePathRelativeToProject, error: error }));
            return;
        }
        const matchedModels = getModelsByQuery(
            {
                filePath: filePath,
                type: objectTypeKeyPath ? _.get(data, objectTypeKeyPath, null) : null,
                modelTypeKeyPath: modelTypeKeyPath
            },
            models
        );
        if (matchedModels.length === 1) {
            contentItems.push(modeledDataItem(filePathRelativeToProject, matchedModels[0], data));
        } else {
            if (matchedModels.length === 0) {
                errors.push(new FileNotMatchedModel({ filePath: filePathRelativeToProject }));
            } else {
                errors.push(new FileMatchedMultipleModels({ filePath: filePathRelativeToProject, modelNames: _.map(matchedModels, 'name') }));
            }
            if (!skipUnmodeledContent) {
                contentItems.push(unmodeledDataItem(filePathRelativeToProject, data));
            }
        }
    });
    return { contentItems, errors };
}

async function loadFile(filePath: string) {
    let data = await parseFile(filePath);
    const extension = path.extname(filePath).substring(1);
    // transform markdown files by unwrapping 'frontmatter' and renaming 'markdown' to 'markdown_content'
    // { frontmatter: { ...fields }, markdown: '...md...' }
    // =>
    // { ...fields, markdown_content: '...md...' }
    if (['md', 'mdx', 'markdown'].includes(extension) && _.has(data, 'frontmatter') && _.has(data, 'markdown')) {
        data = _.assign(data.frontmatter, { markdown_content: data.markdown });
    }
    return data;
}

function modeledDataItem(filePath: string, model: Model, data: any): ContentItem {
    if (isDataModel(model) && model.isList && _.isArray(data)) {
        data = { items: data };
    } else if (isPageModel(model)) {
        if (model.hideContent) {
            data = _.omit(data, 'markdown_content');
        }
    }
    return {
        __metadata: {
            filePath,
            modelName: model.name
        },
        ...data
    };
}

function unmodeledDataItem(filePath: string, data: any): ContentItem {
    return {
        __metadata: {
            filePath,
            modelName: null
        },
        ...data
    };
}

const configFilesSSGMap: Record<string, string[]> = {
    unibit: ['config.yaml', 'config.yml'],
    jekyll: ['_config.yml', '_config.yaml', '_config.toml'],
    hugo: ['config.yaml', 'config.yml', 'config.toml', 'config.json'],
    gatsby: ['site-metadata.json']
};

async function inferConfigFileFromSSGName(config: Config, dirPath: string) {
    const ssgName = config.ssgName;
    if (!ssgName || !(ssgName in configFilesSSGMap)) {
        return;
    }
    const configFiles = configFilesSSGMap[ssgName];
    if (!configFiles) {
        return;
    }
    return getFirstExistingFile(configFiles, dirPath);
}

function getFirstExistingFile(fileNames: string[], inputDir: string) {
    return findPromise(fileNames, (fileName) => {
        const absPath = path.resolve(inputDir, fileName);
        return fse.pathExists(absPath);
    });
}
