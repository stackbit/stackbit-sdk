import path from 'path';
import fse from 'fs-extra';
import yaml from 'js-yaml';
import semver from 'semver';
import _ from 'lodash';

import { validate, ConfigValidationResult, ConfigValidationError } from './config-validator';
import { YamlConfigModel, YamlDataModel, YamlModel, YamlObjectModel, YamlPageModel, YamlConfig, Field, FieldModel, FieldListModel } from './config-schema';
import {
    isListDataModel,
    isObjectListItems,
    isObjectField,
    StricterUnion,
    isCustomModelField,
    isModelField,
    isReferenceField,
    getListItemsField,
    assignLabelFieldIfNeeded
} from '../utils';
import { isPageModel, isListField, extendModels, iterateModelFieldsRecursively } from '../utils';
import { append, parseFile, readDirRecursively, reducePromise, rename } from '@stackbit/utils';

export type BaseModel = {
    name: string;
    __metadata?: {
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

export interface ConfigLoadError {
    name: 'ConfigLoadError';
    message: string;
    internalError?: Error;
    normFieldPath?: undefined;
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
    let config;
    try {
        config = await loadConfigFromDir(dirPath);
    } catch (error) {
        return {
            valid: false,
            config: null,
            errors: [
                {
                    name: 'ConfigLoadError',
                    message: `Error loading Stackbit configuration: ${error.message}`,
                    internalError: error
                }
            ]
        };
    }

    if (!config) {
        return {
            valid: false,
            config: null,
            errors: [
                {
                    name: 'ConfigLoadError',
                    message: 'stackbit.yaml not found, please refer Stackbit documentation: https://www.stackbit.com/docs/stackbit-yaml/'
                }
            ]
        };
    }

    config = normalizeConfig(config);
    const validationResult = validate(config);
    const normalizedConfig = convertToTypedConfig(validationResult);
    const normalizedErrors = normalizeErrors(normalizedConfig, validationResult.errors);
    return {
        valid: validationResult.valid,
        config: normalizedConfig,
        errors: normalizedErrors
    };
}

async function loadConfigFromDir(dirPath: string) {
    let config = await loadConfigFromStackbitYaml(dirPath);
    if (!config) {
        return null;
    }
    const models = await loadExternalModels(dirPath, config);
    config.models = _.assign(models, config.models);
    return config;
}

async function loadConfigFromStackbitYaml(dirPath: string): Promise<any> {
    const stackbitYamlPath = path.join(dirPath, 'stackbit.yaml');
    const stackbitYamlExists = await fse.pathExists(stackbitYamlPath);
    if (!stackbitYamlExists) {
        return null;
    }
    const stackbitYaml = await fse.readFile(stackbitYamlPath);
    const config = yaml.load(stackbitYaml.toString('utf8'), { schema: yaml.JSON_SCHEMA });
    if (!config || typeof config !== 'object') {
        return null;
    }
    return config;
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
            async (models: any, modelFile) => {
                const model = await parseFile(path.join(dirPath, modelFile));
                const modelName = model.name;
                if (!modelName) {
                    return models;
                }
                models[modelName] = _.omit(model, 'name');
                return models;
            },
            {}
        );
    }
    return null;
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
    const models = config?.models || {};
    let polymorphicModelNames: string[] = [];

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

            polymorphicModelNames = _.union(polymorphicModelNames, getPolymorphicModelNames(field));
        });
    });

    _.forEach(polymorphicModelNames, (modelName) => {
        const model = models[modelName];
        // don't add objectTypeKey to page models, they have pageLayoutKey
        if (!model || model.type === 'page') {
            return;
        }

        // TODO: update schema-editor to not show type field
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

/**
 * Returns model names referenced by polymorphic 'model' and 'reference' fields.
 * That is, fields that can have hold objects of different types.
 *
 * @param field
 */
function getPolymorphicModelNames(field: any) {
    if (isListField(field)) {
        field = getListItemsField(field);
    }
    // only 'model' and 'reference' having more than one 'models' are polymorphic
    let polymorphicModelNames: string[] = [];
    if (isModelField(field) && field.models?.length > 1) {
        const modelNames = field.models;
        polymorphicModelNames = _.union(polymorphicModelNames, modelNames);
    } else if (isReferenceField(field) && field.models?.length > 1) {
        const modelNames = field.models;
        polymorphicModelNames = _.union(polymorphicModelNames, modelNames);
    }
    return polymorphicModelNames;
}

function convertToTypedConfig(validationResult: ConfigValidationResult): Config {
    const config = _.cloneDeep(validationResult.value);

    const invalidModelNames = _.reduce(
        validationResult.errors,
        (modelNames: string[], error: ConfigValidationError) => {
            if (error.fieldPath[0] === 'models' && typeof error.fieldPath[1] == 'string') {
                const modelName = error.fieldPath[1];
                modelNames.push(modelName);
            }
            return modelNames;
        },
        []
    );

    // in stackbit.yaml 'models' are defined as object where keys are model names,
    // convert 'models' to array of objects while 'name' property set to the
    // model name
    const modelMap = config.models ?? {};
    let models: Model[] = _.map(
        modelMap,
        (yamlModel: YamlModel, modelName: string): Model => {
            const model: Model = {
                name: modelName,
                ...yamlModel
            };
            if (invalidModelNames.includes(modelName)) {
                _.set(model, '__metadata.invalid', true);
            }
            return model;
        }
    );

    try {
        models = extendModels(models);
    } catch (error) {
        throw error;
    }

    return {
        ...config,
        models: models
    };
}

function normalizeErrors(config: Config, errors: ConfigValidationError[]): ConfigNormalizedValidationError[] {
    return _.map(errors, (error: ConfigValidationError) => {
        if (error.fieldPath[0] === 'models' && typeof error.fieldPath[1] == 'string') {
            const modelName = error.fieldPath[1];
            const modelIndex = _.findIndex(config.models, { name: modelName });
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
}
