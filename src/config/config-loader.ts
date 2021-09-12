import path from 'path';
import fse from 'fs-extra';
import yaml from 'js-yaml';
import semver from 'semver';
import _ from 'lodash';

import { ConfigValidationError, ConfigValidationResult, validate } from './config-validator';
import {
    FieldEnum,
    FieldModel,
    FieldObjectProps,
    YamlConfig,
    YamlConfigModel,
    YamlDataModel,
    YamlModel,
    YamlObjectModel,
    YamlPageModel
} from './config-schema';
import { ConfigLoadError } from './config-errors';
import {
    assignLabelFieldIfNeeded,
    extendModelMap,
    getListItemsField,
    isCustomModelField,
    isEnumField,
    isListDataModel,
    isListField,
    isModelField,
    isObjectField,
    isObjectListItems,
    isPageModel,
    isReferenceField,
    iterateModelFieldsRecursively,
    StricterUnion
} from '../utils';
import { append, parseFile, readDirRecursively, reducePromise, rename } from '@stackbit/utils';

export type BaseModel = {
    name: string;
    __metadata?: {
        filePath?: string;
        invalid?: boolean;
    };
};
export type ObjectModel = YamlObjectModel & BaseModel;
export type DataModel = YamlDataModel & BaseModel;
export type ConfigModel = YamlConfigModel & BaseModel;
export type PageModel = YamlPageModel & BaseModel;
export type Model = StricterUnion<ObjectModel | DataModel | ConfigModel | PageModel>;

export interface Config extends Omit<YamlConfig, 'models'> {
    models: Model[];
}

export interface ConfigNormalizedValidationError extends ConfigValidationError {
    normFieldPath: (string | number)[];
}

export type ConfigError = ConfigLoadError | ConfigNormalizedValidationError;

export interface ConfigLoaderOptions {
    dirPath: string;
}

export interface ConfigLoaderResult {
    valid: boolean;
    config: Config | null;
    errors: ConfigError[];
}

export async function loadConfig({ dirPath }: ConfigLoaderOptions): Promise<ConfigLoaderResult> {
    let configLoadResult;
    try {
        configLoadResult = await loadConfigFromDir(dirPath);
    } catch (error) {
        return {
            valid: false,
            config: null,
            errors: [new ConfigLoadError(`Error loading Stackbit configuration: ${error.message}`, { originalError: error })]
        };
    }

    if (!configLoadResult.config) {
        return {
            valid: false,
            config: null,
            errors: configLoadResult.errors
        };
    }

    const config = normalizeConfig(configLoadResult.config);
    const validationResult = validate(config);
    convertModelCategoriesToModels(validationResult);
    const convertedResult = convertModelsToArray(validationResult);
    const errors = [...configLoadResult.errors, ...convertedResult.errors];
    return {
        valid: validationResult.valid,
        config: convertedResult.config,
        errors: errors
    };
}

async function loadConfigFromDir(dirPath: string): Promise<{ config?: any; errors: ConfigLoadError[] }> {
    let { config, error } = await loadConfigFromStackbitYaml(dirPath);
    if (error) {
        return { errors: [error] };
    }
    const externalModelsResult = await loadExternalModels(dirPath, config);
    config.models = _.assign(externalModelsResult.models, config.models);
    return { config, errors: externalModelsResult.errors };
}

type LoadConfigFromStackbitYamlResult = { config: any; error?: undefined } | { config?: undefined; error: ConfigLoadError };

async function loadConfigFromStackbitYaml(dirPath: string): Promise<LoadConfigFromStackbitYamlResult> {
    const stackbitYamlPath = path.join(dirPath, 'stackbit.yaml');
    const stackbitYamlExists = await fse.pathExists(stackbitYamlPath);
    if (!stackbitYamlExists) {
        return {
            error: new ConfigLoadError('stackbit.yaml was not found, please refer Stackbit documentation: https://www.stackbit.com/docs/stackbit-yaml/')
        };
    }
    const stackbitYaml = await fse.readFile(stackbitYamlPath);
    const config = yaml.load(stackbitYaml.toString('utf8'), { schema: yaml.JSON_SCHEMA });
    if (!config || typeof config !== 'object') {
        return {
            error: new ConfigLoadError('error parsing stackbit.yaml, please refer Stackbit documentation: https://www.stackbit.com/docs/stackbit-yaml/')
        };
    }
    return { config };
}

async function loadExternalModels(dirPath: string, config: any) {
    const modelsSource = _.get(config, 'modelsSource', {});
    const sourceType = _.get(modelsSource, 'type', 'files');
    if (sourceType === 'files') {
        const defaultModelDirs = ['node_modules/@stackbit/components/models', '.stackbit/models'];
        const modelDirs = _.castArray(_.get(modelsSource, 'modelDirs', defaultModelDirs)).map((modelDir: string) => _.trim(modelDir, '/'));
        const modelFiles = await reducePromise(
            modelDirs,
            async (modelFiles: string[], modelDir) => {
                const absModelsDir = path.join(dirPath, modelDir);
                const dirExists = await fse.pathExists(absModelsDir);
                if (!dirExists) {
                    return modelFiles;
                }
                const files = await readModelFilesFromDir(absModelsDir);
                return modelFiles.concat(files.map((filePath) => path.join(modelDir, filePath)));
            },
            []
        );
        return reducePromise(
            modelFiles,
            async (result: { models: any; errors: ConfigLoadError[] }, modelFile) => {
                let model;
                try {
                    model = await parseFile(path.join(dirPath, modelFile));
                } catch (error) {
                    return {
                        models: result.models,
                        errors: result.errors.concat(new ConfigLoadError(`error parsing model, file: ${modelFile}`))
                    };
                }
                const modelName = model.name;
                if (!modelName) {
                    return {
                        models: result.models,
                        errors: result.errors.concat(new ConfigLoadError(`model does not have a name, file: ${modelFile}`))
                    };
                }
                result.models[modelName] = _.omit(model, 'name');
                result.models[modelName].__metadata = {
                    filePath: modelFile
                };
                return result;
            },
            { models: {}, errors: [] }
        );
    }
    return { models: {}, errors: [] };
}

async function readModelFilesFromDir(modelsDir: string) {
    return await readDirRecursively(modelsDir, {
        filter: (filePath, stats) => {
            return stats.isFile() && path.extname(filePath) === '.yaml';
        }
    });
}

async function loadConfigFromDotStackbit(dirPath: string) {
    const stackbitDotPath = path.join(dirPath, '.stackbit');
    const stackbitDotExists = await fse.pathExists(stackbitDotPath);
    if (!stackbitDotExists) {
        return null;
    }

    const config = {};

    const themeYaml = path.join(stackbitDotPath, 'theme.yaml');
    const themeYamlExists = await fse.readFile(themeYaml);
    if (themeYamlExists) {
        const themeConfig = await fse.readFile(themeYaml);
        _.assign(config, themeConfig);
    }

    const studioYaml = path.join(stackbitDotPath, 'studio.yaml');
    const studioYamlExists = await fse.readFile(themeYaml);
    if (studioYamlExists) {
        const studioConfig = await fse.readFile(studioYaml);
        _.assign(config, studioConfig);
    }

    const schemaYaml = path.join(stackbitDotPath, 'schema.yaml');
    const schemaYamlExists = await fse.readFile(themeYaml);
    if (schemaYamlExists) {
        const schemaConfig = await fse.readFile(schemaYaml);
        _.assign(config, schemaConfig);
    }

    return _.isEmpty(config) ? null : config;
}

function normalizeConfig(config: any): any {
    const pageLayoutKey = _.get(config, 'pageLayoutKey', 'layout');
    const objectTypeKey = _.get(config, 'objectTypeKey', 'type');
    const stackbitYamlVersion = String(_.get(config, 'stackbitVersion', ''));
    const ver = semver.coerce(stackbitYamlVersion);
    const isStackbitYamlV2 = ver ? semver.satisfies(ver, '<0.3.0') : false;
    let models = config?.models || {};
    let referencedModelNames: string[] = [];

    try {
        models = extendModelMap(models);
    } catch (error) {
        // TODO: gracefully extend and return error rather throwing
        throw error;
    }

    _.forEach(models, (model) => {
        if (!model) {
            return;
        }

        if (isPageModel(model)) {
            // rename old 'template' property to 'layout'
            rename(model, 'template', 'layout');

            addMarkdownContentField(model);

            // TODO: update schema-editor to not show layout field
            addLayoutFieldToPageModel(model, pageLayoutKey);
        }

        if (isListDataModel(model)) {
            // 'items.type' of list model defaults to 'string', set it explicitly
            if (!_.has(model, 'items.type')) {
                _.set(model, 'items.type', 'string');
            }
            if (isObjectListItems(model.items)) {
                assignLabelFieldIfNeeded(model.items);
            }
        } else if (!_.has(model, 'labelField')) {
            assignLabelFieldIfNeeded(model);
        }

        resolveThumbnailPathForModel(model, model?.__metadata?.filePath);

        iterateModelFieldsRecursively(model, (field: any, fieldPath) => {
            // add field label if label is not set
            if (!_.has(field, 'label')) {
                field.label = _.startCase(field.name);
            }

            if (isListField(field)) {
                // 'items.type' of list field default to 'string', set it explicitly
                if (!_.has(field, 'items.type')) {
                    _.set(field, 'items.type', 'string');
                }
                field = getListItemsField(field);
            }

            if (isObjectField(field)) {
                assignLabelFieldIfNeeded(field);
                resolveThumbnailPathForModel(field, model?.__metadata?.filePath);
            } else if (isEnumField(field)) {
                resolveThumbnailPathForEnumField(field, model?.__metadata?.filePath);
            } else if (isCustomModelField(field, models)) {
                // stackbit v0.2.0 compatibility
                // convert the old custom model field type: { type: 'action' }
                // to the new 'model' field type: { type: 'model', models: ['action'] }
                field.models = [field.type];
                field.type = 'model';
            } else if (field.type === 'models') {
                // stackbit v0.2.0 compatibility
                // convert the old 'models' field type: { type: 'models', models: ['link', 'button'] }
                // to the new 'model' field type: { type: 'model', models: ['link', 'button'] }
                field.type = 'model';
                field.models = _.get(field, 'models', []);
            } else if (field.type === 'model' && _.has(field, 'model')) {
                // stackbit v0.2.0 compatibility
                // convert the old 'model' field type: { type: 'model', model: 'link' }
                // to the new 'model' field type: { type: 'model', models: ['link'] }
                field.models = [field.model];
                delete field.model;
            }

            if (isStackbitYamlV2) {
                // in stackbit.yaml v0.2.x, the 'reference' field was what we have today as 'model' field:
                if (isReferenceField(field)) {
                    field = (field as unknown) as FieldModel;
                    field.type = 'model';
                    field.models = _.get(field, 'models', []);
                }
            }

            referencedModelNames = _.union(referencedModelNames, getReferencedModelNames(field));
        });
    });

    _.forEach(referencedModelNames, (modelName) => {
        const model = models[modelName];
        // don't add objectTypeKey to page models, they have pageLayoutKey
        if (!model || model.type === 'page') {
            return;
        }

        // TODO: update schema-editor to not show type field
        // TODO: do not add objectTypeKey field to models, API/container should
        //  be able to add it automatically when data object or polymorphic nested model is added
        addObjectTypeKeyField(model, objectTypeKey, modelName);
    });

    return config;
}

function addMarkdownContentField(model: PageModel) {
    if (!model.hideContent) {
        append(model, 'fields', {
            type: 'markdown',
            name: 'markdown_content',
            label: 'Content',
            description: 'Page content'
        });
    }
}

function addLayoutFieldToPageModel(model: any, pageLayoutKey: any) {
    const modelLayout = _.get(model, 'layout');
    if (!modelLayout) {
        return;
    }
    const hasLayoutField = _.find(_.get(model, 'fields'), { name: pageLayoutKey });
    if (hasLayoutField) {
        return;
    }
    append(model, 'fields', {
        type: 'string',
        name: pageLayoutKey,
        label: _.startCase(pageLayoutKey),
        const: modelLayout,
        hidden: true
    });
}

function addObjectTypeKeyField(model: any, objectTypeKey: string, modelName: string) {
    const hasObjectTypeField = _.find(_.get(model, 'fields'), { name: objectTypeKey });
    if (hasObjectTypeField) {
        return;
    }
    append(model, 'fields', {
        type: 'string',
        name: objectTypeKey,
        label: 'Object Type',
        description: 'The type of the object',
        const: modelName,
        hidden: true
    });
}

function resolveThumbnailPathForModel(modelOrField: Model | FieldObjectProps, modelFilePath: string | undefined) {
    if (modelOrField.thumbnail && modelFilePath) {
        const modelDirPath = path.dirname(modelFilePath);
        modelOrField.thumbnail = resolveThumbnailPath(modelOrField.thumbnail, modelDirPath);
    }
}

function resolveThumbnailPathForEnumField(enumField: FieldEnum, modelFilePath: string | undefined) {
    if (enumField.controlType === 'thumbnails' && modelFilePath) {
        const modelDirPath = path.dirname(modelFilePath);
        _.forEach(enumField.options, (option) => {
            if (option.thumbnail) {
                option.thumbnail = resolveThumbnailPath(option.thumbnail, modelDirPath);
            }
        });
    }
}

function resolveThumbnailPath(thumbnail: string, modelDirPath: string) {
    if (thumbnail.startsWith('/')) {
        if (modelDirPath.endsWith('@stackbit/components/models')) {
            modelDirPath = modelDirPath.replace(/\/models$/, '');
        } else {
            modelDirPath = '';
        }
        thumbnail = thumbnail.replace(/^\//, '');
    }
    return path.join(modelDirPath, thumbnail);
}

/**
 * Returns model names referenced by polymorphic 'model' and 'reference' fields.
 * That is, fields that can hold objects of different types.
 *
 * @param field
 */
function getReferencedModelNames(field: any) {
    if (isListField(field)) {
        field = getListItemsField(field);
    }
    // TODO: add type field to model fields inside container update/create object logic rather adding type to schema
    // 'object' models referenced by 'model' fields should have 'type' field
    // if these fields have than 1 model.
    // 'data' models referenced by 'reference' fields should always have 'type' field.
    let referencedModelNames: string[] = [];
    if (isModelField(field) && field.models?.length > 1) {
        const modelNames = field.models;
        referencedModelNames = _.union(referencedModelNames, modelNames);
    } else if (isReferenceField(field) && field.models?.length > 0) {
        const modelNames = field.models;
        referencedModelNames = _.union(referencedModelNames, modelNames);
    }
    return referencedModelNames;
}

function convertModelCategoriesToModels(validationResult: ConfigValidationResult) {
    const models = validationResult.value?.models ?? {};

    const categoryMap = _.reduce(models, (categoryMap, model, modelName) => {
        if (!model.categories) {
            return categoryMap;
        }
        let key = model?.type === 'object' ? 'objectModels' : 'documentModels';
        _.forEach(model.categories, (categoryName) => {
            append(categoryMap, [categoryName, key], modelName);
        });
        delete model.categories;
        return categoryMap;
    }, {} as Record<string, { objectModels?: string[], documentModels?: string[] }>);

    _.forEach(categoryMap, (category, categoryName) => {
        _.forEach(category, (modelCategory, key) => {
            _.set(category, key, _.uniq(modelCategory));
        });
    });

    _.forEach(models, (model) => {
        iterateModelFieldsRecursively(model, (field: any) => {
            if (isListField(field)) {
                field = getListItemsField(field);
            }
            if (field.categories) {
                let key: string | null = null;
                if (isModelField(field)) {
                    key = 'objectModels';
                } else if (isReferenceField(field)) {
                    key = 'documentModels';
                }
                if (key) {
                    field.models = _.reduce(field.categories, (modelNames, categoryName) => {
                        const objectModelNames = _.get(categoryMap, [categoryName, key], []);
                        return _.uniq(modelNames.concat(objectModelNames));
                    }, field.models || []);
                }
                delete field.categories;
            }
        });
    })
}

function convertModelsToArray(validationResult: ConfigValidationResult): { config: Config; errors: ConfigNormalizedValidationError[] } {
    const config = _.cloneDeep(validationResult.value);

    // in stackbit.yaml 'models' are defined as object where keys are the model names,
    // convert 'models' to array of objects and set their 'name' property to the
    // model name
    const modelMap = config.models ?? {};
    let modelArray: Model[] = _.map(
        modelMap,
        (yamlModel: YamlModel, modelName: string): Model => {
            return {
                name: modelName,
                ...yamlModel
            };
        }
    );

    const convertedErrors = _.map(validationResult.errors, (error: ConfigValidationError) => {
        if (error.fieldPath[0] === 'models' && typeof error.fieldPath[1] == 'string') {
            const modelName = error.fieldPath[1];
            const modelIndex = _.findIndex(modelArray, { name: modelName });
            const normFieldPath = error.fieldPath.slice();
            normFieldPath[1] = modelIndex;
            return {
                ...error,
                normFieldPath
            };
        }
        return {
            ...error,
            normFieldPath: error.fieldPath
        };
    });

    return {
        config: {
            ...config,
            models: modelArray
        },
        errors: convertedErrors
    };
}
