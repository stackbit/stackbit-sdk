import path from 'path';
import fse from 'fs-extra';
import yaml from 'js-yaml';
import _ from 'lodash';
import { extendModels, iterateModelFieldsRecursively, isListField } from '@stackbit/schema';

import { validate, ConfigValidationResult, ConfigValidationError } from './config-validator';
import { Field, YamlConfigModel, YamlDataModel, YamlModel, YamlObjectModel, YamlPageModel, YamlConfig } from './config-schema';
import { StricterUnion } from '../utils';
import { isPageModel } from '../schema-utils';
import { parseFile, readDirRecursively, reducePromise } from '@stackbit/utils';

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

    const validationResult = validate(config);
    const normalizedConfig = normalizeConfig(validationResult);
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
                models[model.name] = _.omit(model, 'name');
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

function normalizeConfig(validationResult: ConfigValidationResult): Config {
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
            if (isPageModel(model) && !model.hideContent && model.fields) {
                model.fields.push({
                    type: 'markdown',
                    name: 'markdown_content',
                    label: 'Content',
                    description: 'Page content'
                });
            }
            return model;
        }
    );
    models = extendModels(models);
    _.forEach(models, (model: Model) => {
        iterateModelFieldsRecursively(model, (field: Field) => {
            // add field label if label is not set but name is set
            // 'name' can be unset for nested 'object' fields or list items fields
            if (!_.has(field, 'label')) {
                field.label = _.startCase(field.name);
            }

            if (isListField(field) && !_.has(field, 'items.type')) {
                _.set(field, 'items.type', 'string');
            }
        });
    });
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
