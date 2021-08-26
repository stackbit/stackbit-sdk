import _ from 'lodash';
import fse from 'fs-extra';
import path from 'path';
import micromatch from 'micromatch';
import { findPromise, forEachPromise, parseFile, readDirRecursively } from '@stackbit/utils';

import { Config, ConfigModel, Model } from '../config/config-loader';
import { Field, FieldListItems, FieldModelProps } from '../config/config-schema';
import { FileForModelNotFoundError, FileMatchedMultipleModelsError, FileNotMatchedModelError, FileReadError, FolderReadError } from './content-errors';
import {
    isConfigModel,
    isDataModel,
    isPageModel,
    getModelsByQuery,
    getListItemsField,
    isListField,
    isModelField,
    isListDataModel,
    isModelListItems,
    getModelOfObject
} from '../utils';
import { validate } from './content-validator';
import { DATA_FILE_EXTENSIONS, EXCLUDED_DATA_FILES, EXCLUDED_MARKDOWN_FILES, EXCLUDED_COMMON_FILES, MARKDOWN_FILE_EXTENSIONS } from '../consts';

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

export interface ContentLoaderOptions {
    dirPath: string;
    config: Config;
    skipUnmodeledContent: boolean;
}

export interface ContentLoaderResult {
    valid: boolean;
    contentItems: ContentItem[];
    errors: Error[];
}

export async function loadContent({ dirPath, config, skipUnmodeledContent }: ContentLoaderOptions): Promise<ContentLoaderResult> {
    const { contentItems: dataItems, errors: dataErrors } = await loadDataFiles({ dirPath, config, skipUnmodeledContent });
    const { contentItems: pageItems, errors: pageErrors } = await loadPageFiles({ dirPath, config, skipUnmodeledContent });
    const contentItems = _.concat(dataItems, pageItems);
    const validationResult = validate({ contentItems, config });
    const errors = _.concat(dataErrors, pageErrors, validationResult.errors);
    return {
        valid: _.isEmpty(errors),
        contentItems: validationResult.value,
        errors: errors
    };
}

async function loadDataFiles({ dirPath, config, skipUnmodeledContent }: ContentLoaderOptions) {
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
    const dataDirExists = await fse.pathExists(absDataDirPath);
    if (!dataDirExists) {
        return { contentItems, errors };
    }

    const objectTypeKey = config.objectTypeKey || 'type';
    const excludedFiles = [...EXCLUDED_COMMON_FILES];
    const dataModels = config.models.filter(isDataModel);

    if (dataDir === '') {
        excludedFiles.push(...EXCLUDED_DATA_FILES);
        if (configFilePath) {
            excludedFiles.push(configFilePath);
        }
        if (config.publishDir) {
            excludedFiles.push(config.publishDir);
        }
    }

    let filePaths;
    try {
        filePaths = await readDirRecursivelyWithFilter(absDataDirPath, excludedFiles, DATA_FILE_EXTENSIONS);
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
        config: config,
        objectTypeKeyPath: objectTypeKey,
        modelTypeKeyPath: 'name',
        skipUnmodeledContent
    });
    contentItems.push(...result.contentItems);
    errors.push(...result.errors);

    return { contentItems, errors };
}

async function loadPageFiles({ dirPath, config, skipUnmodeledContent }: ContentLoaderOptions) {
    const contentItems: ContentItem[] = [];
    const errors: Error[] = [];

    // if user specifically set pagesDir to null, opt-out from loading page files all-together
    if (config.pagesDir === null) {
        return { contentItems, errors };
    }

    // if pagesDir was not set, assume empty string as root folder
    const pagesDir = config.pagesDir || '';
    const absPagesDirPath = path.join(dirPath, pagesDir);
    const pageDirExists = await fse.pathExists(absPagesDirPath);
    if (!pageDirExists) {
        return { contentItems, errors };
    }

    const pageLayoutKey = config.pageLayoutKey || 'layout';
    const excludedFiles = _.castArray(config.excludePages || []).concat(EXCLUDED_COMMON_FILES);
    const pageModels = config.models.filter(isPageModel);

    if (pagesDir === '') {
        excludedFiles.push(...EXCLUDED_MARKDOWN_FILES);
        if (config.publishDir) {
            excludedFiles.push(config.publishDir);
        }
    }

    let filePaths;
    try {
        filePaths = await readDirRecursivelyWithFilter(absPagesDirPath, excludedFiles, MARKDOWN_FILE_EXTENSIONS);
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
        config: config,
        objectTypeKeyPath: pageLayoutKey,
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
            error: new FileForModelNotFoundError({ modelName: configModel.name })
        };
    }
    const extension = path.extname(filePath).substring(1);
    if (!DATA_FILE_EXTENSIONS.includes(extension)) {
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
            contentItem: modeledDataItem(filePath, data, configModel, config)
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
            // return true for all directories to read them recursively
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
    config: Config;
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
 * @param options.config Config
 * @param options.objectTypeKeyPath The key path of object field to match a model
 * @param options.modelTypeKeyPath The key path of model property to match an object
 * @param options.skipUnmodeledContent Don't return un-modeled data
 */
async function loadContentItems({
    projectDir,
    contentDir,
    filePaths,
    models,
    config,
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
        const fileIsInProjectDir = path.parse(filePathRelativeToProject).dir === '';
        let data;
        try {
            data = await loadFile(absFilePath, fileIsInProjectDir);
        } catch (error) {
            errors.push(new FileReadError({ filePath: filePathRelativeToProject, error: error }));
            return;
        }
        if (data === null) {
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
            contentItems.push(modeledDataItem(filePathRelativeToProject, data, matchedModels[0]!, config));
        } else {
            if (matchedModels.length === 0) {
                errors.push(new FileNotMatchedModelError({ filePath: filePathRelativeToProject }));
            } else {
                errors.push(new FileMatchedMultipleModelsError({ filePath: filePathRelativeToProject, modelNames: _.map(matchedModels, 'name') }));
            }
            if (!skipUnmodeledContent) {
                contentItems.push(unmodeledDataItem(filePathRelativeToProject, data));
            }
        }
    });
    return { contentItems, errors };
}

async function loadFile(filePath: string, fileIsInProjectDir = false) {
    let data = await parseFile(filePath);
    const extension = path.extname(filePath).substring(1);
    // transform markdown files by unwrapping 'frontmatter' and renaming 'markdown' to 'markdown_content'
    // { frontmatter: { ...fields }, markdown: '...md...' }
    // =>
    // { ...fields, markdown_content: '...md...' }
    if (MARKDOWN_FILE_EXTENSIONS.includes(extension) && _.has(data, 'frontmatter') && _.has(data, 'markdown')) {
        if (fileIsInProjectDir && _.get(data, 'frontmatter') === null) {
            return null;
        }
        data = _.assign(data.frontmatter, { markdown_content: data.markdown });
    }
    return data;
}

function modeledDataItem(filePath: string, data: any, model: Model, config: Config): ContentItem {
    if (isPageModel(model)) {
        if (model.hideContent) {
            data = _.omit(data, 'markdown_content');
        }
    }
    const pageLayoutKey = config.pageLayoutKey || 'layout';
    const objectTypeKey = config.objectTypeKey || 'type';
    const modelsByName = _.keyBy(config.models, 'name');
    data = addMetadataRecursively({ value: data, model, modelsByName, pageLayoutKey, objectTypeKey, valueId: filePath });
    if (isListDataModel(model) && _.isArray(data)) {
        data = { items: data };
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

function addMetadataRecursively({
    value,
    model,
    modelsByName,
    pageLayoutKey,
    objectTypeKey,
    valueId
}: {
    value: any;
    model: Model;
    modelsByName: Record<string, Model>;
    pageLayoutKey: string;
    objectTypeKey: string;
    valueId?: string;
}) {
    if (!model) {
        return value;
    }

    function _mapDeep({
        value,
        model,
        field,
        fieldListItem,
        valueKeyPath,
        modelKeyPath
    }: {
        value: any;
        model: Model | null;
        field: Field | null;
        fieldListItem: FieldListItems | null;
        valueKeyPath: (string | number)[];
        modelKeyPath: string[];
    }) {
        let modelField: FieldModelProps | null = null;
        if (field && isModelField(field)) {
            modelField = field;
        } else if (fieldListItem && isModelListItems(fieldListItem)) {
            modelField = fieldListItem;
        }

        if (_.isPlainObject(value) && modelField) {
            const modelResult = getModelOfObject({
                object: value,
                field: modelField,
                modelsByName,
                pageLayoutKey,
                objectTypeKey,
                valueKeyPath,
                modelKeyPath
            });
            if ('error' in modelResult) {
                return {
                    __metadata: {
                        modelName: null,
                        error: modelResult.error
                    },
                    ...value
                };
            }
            model = modelResult.model;
            field = null;
            fieldListItem = null;
            modelKeyPath = [model.name];
            value = {
                __metadata: {
                    modelName: model.name
                },
                ...value
            };
        }

        // Use lodash methods here, the models and values can be invalid, and therefore not all required properties might exist
        if (_.isPlainObject(value)) {
            const modelOrField = model || field || fieldListItem;
            const fields = _.get(modelOrField, 'fields', []);
            const fieldsByName = _.keyBy(fields, 'name');
            value = _.mapValues(value, (val, key) => {
                if (key === '__metadata') {
                    return val;
                }
                // field might not be defined in the model, for example implicit fields like 'layout' and 'type'
                // or for nested objects with unmatched models
                const field = _.get(fieldsByName, key, null);
                return _mapDeep({
                    value: val,
                    model: null,
                    field: field,
                    fieldListItem: null,
                    valueKeyPath: _.concat(valueKeyPath, key),
                    modelKeyPath: _.concat(modelKeyPath, ['fields', key])
                });
            });
        } else if (_.isArray(value)) {
            let fieldListItems: FieldListItems;
            if (field && isListField(field)) {
                fieldListItems = getListItemsField(field);
            } else if (model && isListDataModel(model)) {
                fieldListItems = model.items;
            } else {
                return value;
            }
            value = _.map(value, (val, idx) => {
                return _mapDeep({
                    value: val,
                    model: null,
                    field: null,
                    fieldListItem: fieldListItems,
                    valueKeyPath: _.concat(valueKeyPath, idx),
                    modelKeyPath: _.concat(modelKeyPath, 'items')
                });
            });
        }

        return value;
    }

    return _mapDeep({
        value: value,
        model: model,
        field: null,
        fieldListItem: null,
        valueKeyPath: valueId ? [valueId] : [],
        modelKeyPath: [model.name]
    });
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
