import path from 'path';
import fse from 'fs-extra';
import yaml from 'js-yaml';
import _ from 'lodash';
import { extendModels, iterateModelFieldsRecursively, isListField } from '@stackbit/schema';
import { StricterUnion } from '../utils';

import { validate } from './config-validator';
import { IField, IYamlConfigModel, IYamlDataModel, IYamlModel, IYamlObjectModel, IYamlPageModel, IYamlConfig } from './config-schema';

interface LoadConfigOptions {
    dirPath: string;
}

export type IObjectModel = IYamlObjectModel & { name: string };
export type IDataModel = IYamlDataModel & { name: string };
export type IConfigModel = IYamlConfigModel & { name: string };
export type IPageModel = IYamlPageModel & { name: string };
export type IModel = StricterUnion<IObjectModel | IDataModel | IConfigModel | IPageModel>;

export interface IConfig extends Omit<IYamlConfig, 'models'> {
    models: IModel[];
}

export async function loadConfig({ dirPath }: LoadConfigOptions) {
    let config;
    try {
        config = await loadConfigFromDir(dirPath);
    } catch (error) {
        return {
            config: null,
            errors: [{ message: 'Error loading Stackbit configuration', details: error }]
        };
    }

    if (!config) {
        return {
            config: null,
            errors: [
                {
                    message: 'Stackbit configuration not found, please refer Stackbit documentation: https://www.stackbit.com/docs/stackbit-yaml/'
                }
            ]
        };
    }
    const validationResult = validate(config);
    const normalizedConfig = normalizeConfig(config as any); // @Simon: There's no reason to believe this would work. We didn't even check if it's valid.
    return {
        config: normalizedConfig,
        errors: validationResult.errors
    };
}

async function loadConfigFromDir(dirPath: string) {
    let config = await loadConfigFromStackbitYaml(dirPath);
    if (config) {
        return config;
    }
    config = await loadConfigFromDotStackbit(dirPath);
    if (config) {
        return config;
    }
    return null;
}

async function loadConfigFromStackbitYaml(dirPath: string) {
    const stackbitYamlPath = path.join(dirPath, 'stackbit.yaml');
    const stackbitYamlExists = await fse.pathExists(stackbitYamlPath);
    if (!stackbitYamlExists) {
        return null;
    }
    const stackbitYaml = await fse.readFile(stackbitYamlPath);
    return yaml.load(stackbitYaml.toString('utf8'), { schema: yaml.JSON_SCHEMA });
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

function normalizeConfig(config: IYamlConfig): IConfig {
    config = _.cloneDeep(config);

    // in stackbit.yaml 'models' are defined as object where keys are model names,
    // convert 'models' to array of objects while 'name' property set to the
    // model name
    const modelMap = config.models ?? {};
    let models: IModel[] = _.map(
        modelMap,
        (yamlModel: IYamlModel, modelName: string): IModel => {
            const model: IModel = {
                name: modelName,
                ...yamlModel
            };
            if (model.type === 'page' && !model.hideContent && model.fields) {
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
    _.forEach(models, (model: IModel) => {
        iterateModelFieldsRecursively(model, (field: IField) => {
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
