import { ISchema } from './config-schema';

const path = require('path');
const fse = require('fs-extra');
const yaml = require('js-yaml');
const _ = require('lodash');
const { extendModels, iterateModelFieldsRecursively, isListField } = require('@stackbit/schema');

const { validate } = require('./config-validator');

interface LoadConfigOptions {
    dirPath: string;
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
    const normalizedConfig = normalizeConfig(config);
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
    return yaml.load(stackbitYaml, { schema: yaml.JSON_SCHEMA });
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

function normalizeConfig(config: any): ISchema {
    config = _.cloneDeep(config);
    // in stackbit.yaml models are defined as object with keys,
    // convert them to arrays while setting the key to name property
    const modelMap = config.models ?? {};
    let models = _.map(modelMap, (model: any, modelName: string) => {
        model.name = modelName;
        return model;
    });
    models = extendModels(models);
    _.forEach(models, (model: any) => {
        iterateModelFieldsRecursively(model, (field: any, fieldPath: string[]) => {
            // add field label if label is not set but name is set
            // 'name' can be unset for nested 'object' fields or list items fields
            if (!_.has(field, 'label') && _.has(field, 'name')) {
                field.label = _.startCase(field.name);
            }

            if (isListField(field) && !_.has(field, 'items.type')) {
                _.set(field, 'items.type', 'string');
            }
        });
    });
    config.models = models;
    return config;
}
