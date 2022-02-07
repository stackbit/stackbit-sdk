import path from 'path';
import fse from 'fs-extra';
import yaml from 'js-yaml';
import semver from 'semver';
import _ from 'lodash';

import { ConfigValidationResult, validateConfig, validateContentModels } from './config-validator';
import { ConfigError, ConfigLoadError, ConfigValidationError } from './config-errors';
import {
    assignLabelFieldIfNeeded,
    extendModelMap,
    getListFieldItems,
    isCustomModelField,
    isEnumField,
    isListDataModel,
    isListField,
    isModelField,
    isObjectField,
    isObjectListItems,
    isPageModel,
    isDataModel,
    isReferenceField,
    iterateModelFieldsRecursively,
    mapModelFieldsRecursively,
    normalizeListFieldInPlace,
    getModelFieldForModelKeyPath
} from '../utils';
import { append, omitByNil, parseFile, readDirRecursively, reducePromise, rename } from '@stackbit/utils';
import { Config, DataModel, FieldEnum, FieldModel, FieldObjectProps, Model, ModelsSource, PageModel, YamlModel } from './config-types';
import { loadPresets } from './presets-loader';

export interface ConfigLoaderOptions {
    dirPath: string;
    modelsSource?: ModelsSource;
}

export interface ConfigLoaderResult {
    valid: boolean;
    config: Config | null;
    errors: ConfigError[];
}

export interface NormalizedValidationResult {
    valid: boolean;
    config: Config;
    errors: ConfigValidationError[];
}

export interface TempConfigLoaderResult {
    config?: Record<string, any>;
    errors: ConfigLoadError[];
}

export async function loadConfig({ dirPath, modelsSource }: ConfigLoaderOptions): Promise<ConfigLoaderResult> {
    const { config, errors: configLoadErrors } = await loadConfigFromDir(dirPath);

    if (!config) {
        return {
            valid: false,
            config: null,
            errors: configLoadErrors
        };
    }

    const { models: externalModels, errors: externalModelsLoadErrors } = await loadModelsFromExternalSource(config, dirPath, modelsSource);

    const normalizedResult = validateAndNormalizeConfig(config, externalModels);

    const presetsResult = await loadPresets(dirPath, normalizedResult.config);

    return {
        valid: normalizedResult.valid,
        config: presetsResult.config,
        errors: [...configLoadErrors, ...externalModelsLoadErrors, ...normalizedResult.errors, ...presetsResult.errors]
    };
}

export function validateAndNormalizeConfig(config: Record<string, any>, externalModels?: Model[]): NormalizedValidationResult {
    // extend config models having the "extends" property
    // this must be done before any validation as some properties like
    // the labelField will not work when validating models without extending them first
    const { models: extendedModels, errors: extendModelErrors } = extendModelMap(config.models as any);
    const extendedConfig = {
        ...config,
        models: extendedModels
    };

    const { config: mergedConfig, errors: externalModelsMergeErrors } = mergeConfigWithExternalModels(extendedConfig, externalModels);

    // validate the "contentModels" and extend config models with "contentModels"
    // this must be done before main config validation to make it independent of "contentModels".
    const { value: configWithContentModels, errors: contentModelsErrors } = validateAndExtendContentModels(mergedConfig);

    // normalize config - backward compatibility updates, adding extra fields like "markdown_content", "type" and "layout",
    // and setting other default values.
    const normalizedConfig = normalizeConfig(configWithContentModels);

    // validate config
    const { value: validatedConfig, errors: validationErrors } = validateConfig(normalizedConfig);

    const errors = [...extendModelErrors, ...externalModelsMergeErrors, ...contentModelsErrors, ...validationErrors];

    return normalizeValidationResult({
        valid: _.isEmpty(errors),
        value: validatedConfig,
        errors: errors
    });
}

async function loadConfigFromDir(dirPath: string): Promise<TempConfigLoaderResult> {
    try {
        const stackbitYamlResult = await loadConfigFromStackbitYaml(dirPath);
        if (stackbitYamlResult.error) {
            return { errors: [stackbitYamlResult.error] };
        }

        const { models: modelsFromFiles, errors: fileModelsErrors } = await loadModelsFromFiles(dirPath, stackbitYamlResult.config);

        const mergedModels = mergeConfigModelsWithModelsFromFiles(stackbitYamlResult.config.models ?? {}, modelsFromFiles);

        return {
            config: {
                ...stackbitYamlResult.config,
                models: mergedModels
            },
            errors: fileModelsErrors
        };
    } catch (error) {
        return {
            errors: [new ConfigLoadError(`Error loading Stackbit configuration: ${error.message}`, { originalError: error })]
        };
    }
}

type StackbitYamlConfigResult = { config: Record<string, any>; error?: never } | { config?: never; error: ConfigLoadError };

async function loadConfigFromStackbitYaml(dirPath: string): Promise<StackbitYamlConfigResult> {
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

async function loadModelsFromFiles(dirPath: string, config: Record<string, any>): Promise<{ models: Record<string, any>; errors: ConfigLoadError[] }> {
    const modelsSource = _.get(config, 'modelsSource', {});
    const sourceType = _.get(modelsSource, 'type', 'files');
    const defaultModelDirs = ['node_modules/@stackbit/components/models', '.stackbit/models'];
    const modelDirs =
        sourceType === 'files'
            ? _.castArray(_.get(modelsSource, 'modelDirs', defaultModelDirs)).map((modelDir: string) => _.trim(modelDir, '/'))
            : defaultModelDirs;

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
            const modelName = model?.name;
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

async function readModelFilesFromDir(modelsDir: string) {
    return await readDirRecursively(modelsDir, {
        filter: (filePath, stats) => {
            if (stats.isDirectory()) {
                return true;
            }
            const extension = path.extname(filePath).substring(1);
            return stats.isFile() && ['yaml', 'yml'].includes(extension);
        }
    });
}

async function loadModelsFromExternalSource(
    config: Record<string, any>,
    dirPath: string,
    modelsSource?: ModelsSource
): Promise<{ models: Model[]; errors: ConfigLoadError[] }> {
    modelsSource = _.assign({}, modelsSource, config.modelSource);
    const sourceType = _.get(modelsSource, 'type', 'files');
    if (sourceType === 'files') {
        // we already loaded models from files inside loadModelsFromFiles function
        return { models: [], errors: [] };
    } else if (sourceType === 'contentful') {
        const contentfulModule = _.get(modelsSource, 'module', '@stackbit/cms-contentful');
        const modulePath = path.resolve(dirPath, 'node_modules', contentfulModule);
        const module = await import(modulePath);
        try {
            const { models } = await module.fetchAndConvertSchema(_.omit(modelsSource, ['type', 'module']));
            return {
                models: models,
                errors: []
            };
        } catch (error) {
            return {
                models: [],
                errors: [new ConfigLoadError(`Error fetching and converting Contentful schema, error: ${error.message}`, { originalError: error })]
            };
        }
    }
    return {
        models: [],
        errors: [new ConfigLoadError(`modelsSource ${modelsSource} is unsupported`)]
    };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
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

function mergeConfigModelsWithModelsFromFiles(configModels: any, modelsFromFiles: Record<string, any>) {
    const mergedModels = _.mapValues(modelsFromFiles, (modelFromFile, modelName) => {
        // resolve thumbnails of models loaded from files
        const modelFilePath = modelFromFile.__metadata?.filePath;
        resolveThumbnailPathForModel(modelFromFile, modelFilePath);
        iterateModelFieldsRecursively(modelFromFile, (field: any) => {
            if (isListField(field)) {
                field = normalizeListFieldInPlace(field);
                field = field.items;
            }
            if (isObjectField(field)) {
                resolveThumbnailPathForModel(field, modelFilePath);
            } else if (isEnumField(field)) {
                resolveThumbnailPathForEnumField(field, modelFilePath);
            }
        });

        const configModel = _.get(configModels, modelName);
        if (!configModel) {
            return modelFromFile;
        }

        return _.assign({}, modelFromFile, configModel, {
            fields: _.unionBy(configModel?.fields ?? [], modelFromFile?.fields ?? [], 'name')
        });
    });
    return Object.assign({}, configModels, mergedModels);
}

function mergeConfigWithExternalModels(config: any, externalModels?: Model[]): { config: any; errors: ConfigValidationError[] } {
    if (!externalModels || externalModels.length === 0) {
        return {
            config,
            errors: []
        };
    }

    const stackbitModels = config?.models ?? {};
    const errors: ConfigValidationError[] = [];

    const models = _.reduce(
        externalModels,
        (modelMap: Record<string, YamlModel>, externalModel) => {
            const { name, ...rest } = externalModel;
            return Object.assign(modelMap, { [name]: rest });
        },
        {}
    );

    _.forEach(stackbitModels, (stackbitModel: any, modelName: any) => {
        let externalModel = models[modelName];
        if (!externalModel) {
            return;
        }

        const modelType = stackbitModel.type ? (stackbitModel.type === 'config' ? 'data' : stackbitModel.type) : externalModel.type ?? 'object';
        const urlPath = modelType === 'page' ? stackbitModel?.urlPath ?? '/{slug}' : null;

        externalModel = Object.assign(
            {},
            externalModel,
            _.pick(stackbitModel, ['__metadata', 'label', 'description', 'thumbnail', 'singleInstance', 'readOnly', 'labelField', 'fieldGroups']),
            omitByNil({
                type: modelType,
                urlPath
            })
        );

        externalModel = mapModelFieldsRecursively(externalModel as Model, (externalField, modelKeyPath) => {
            const stackbitField = getModelFieldForModelKeyPath(stackbitModel, modelKeyPath);
            if (!stackbitField) {
                return externalField;
            }

            let override = {};
            if (externalField.type === 'json' && stackbitField.type === 'style') {
                override = stackbitField;
            } else if (externalField.type === 'string' && stackbitField.type === 'color') {
                override = { type: 'color' };
            } else if (externalField.type === 'enum') {
                override = _.pick(stackbitField, ['options']);
            } else if (externalField.type === 'number') {
                override = _.pick(stackbitField, ['subtype', 'min', 'max', 'step', 'unit']);
            } else if (externalField.type === 'object') {
                override = _.pick(stackbitField, ['labelField', 'thumbnail', 'fieldGroups']);
            }

            return Object.assign(
                {},
                externalField,
                _.pick(stackbitField, ['label', 'description', 'required', 'default', 'group', 'const', 'hidden', 'readOnly', 'controlType']),
                override
            );
        }) as YamlModel;

        models[modelName] = externalModel;
    });

    return {
        config: {
            ...config,
            models: models
        },
        errors: errors
    };
}

function normalizeConfig(config: any): any {
    const pageLayoutKey = _.get(config, 'pageLayoutKey', 'layout');
    const objectTypeKey = _.get(config, 'objectTypeKey', 'type');
    const stackbitYamlVersion = String(_.get(config, 'stackbitVersion', ''));
    const ver = semver.coerce(stackbitYamlVersion);
    const isStackbitYamlV2 = ver ? semver.satisfies(ver, '<0.3.0') : false;
    const models = config?.models || {};
    const gitCMS = isGitCMS(config);
    let referencedModelNames: string[] = [];

    _.forEach(models, (model, modelName) => {
        if (!model) {
            return;
        }

        if (!_.has(model, 'type')) {
            model.type = 'object';
        }

        // add model label if not set
        if (!_.has(model, 'label')) {
            model.label = _.startCase(modelName);
        }

        if (_.has(model, 'fields') && !Array.isArray(model.fields)) {
            model.fields = [];
        }

        if (isPageModel(model)) {
            // rename old 'template' property to 'layout'
            rename(model, 'template', 'layout');

            updatePageUrlPath(model);

            if (gitCMS) {
                updatePageFilePath(model, config);
                addMarkdownContentField(model);

                // TODO: update schema-editor to not show layout field
                addLayoutFieldToPageModel(model, pageLayoutKey);
            }
        } else if (isDataModel(model) && gitCMS) {
            updateDataFilePath(model, config);
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

        iterateModelFieldsRecursively(model, (field: any) => {
            // add field label if label is not set
            if (!_.has(field, 'label')) {
                field.label = _.startCase(field.name);
            }

            if (isListField(field)) {
                field = normalizeListFieldInPlace(field);
                field = field.items;
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

            if (gitCMS) {
                referencedModelNames = _.union(referencedModelNames, getReferencedModelNames(field));
            }
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

function updatePageUrlPath(model: PageModel) {
    // set default urlPath if not set
    if (!model.urlPath) {
        model.urlPath = '/{slug}';
    }
}

/**
 * Sets the page model's filePath pattern.
 * If the model has `filePath` property, it is prefixed with `pagesDir` and returned.
 * If the model has no `filePath` property, then `filePath` is naively inferred by
 * prefixing `urlPath` with `pagesDir` and appending the `.md` extension.
 */
function updatePageFilePath(model: PageModel, config: Config) {
    let filePath;
    if (model.filePath) {
        filePath = model.filePath;
    } else if (model.file) {
        filePath = model.file;
    } else {
        const urlPath = model.urlPath;
        if (urlPath === '/') {
            filePath = 'index.md';
        } else if (_.trim(urlPath, '/') === 'posts/{slug}' && config.ssgName === 'jekyll') {
            filePath = '_posts/{moment_format("YYYY-MM-DD")}-{slug}.md';
        } else {
            filePath = _.trim(urlPath, '/') + '.md';
        }
    }
    const parentDir = _.trim(config.pagesDir ?? '', '/');
    model.filePath = path.join(parentDir, filePath);
}

function updateDataFilePath(model: DataModel, config: Config) {
    let filePath;
    if (model.filePath) {
        filePath = model.filePath;
    } else if (model.file) {
        filePath = model.file;
    } else {
        const folder = _.trim(_.get(model, 'folder'), '/');
        filePath = _.trim(`${folder}/{slug}.json`, '/');
    }
    const parentDir = _.trim(config.dataDir ?? '', '/');
    model.filePath = path.join(parentDir, filePath);
}

function addMarkdownContentField(model: PageModel) {
    if (model.hideContent) {
        return;
    }
    const hasMarkdownContent = _.find(_.get(model, 'fields'), { name: 'markdown_content' });
    if (hasMarkdownContent) {
        return;
    }
    append(model, 'fields', {
        type: 'markdown',
        name: 'markdown_content',
        label: 'Content',
        description: 'Page content'
    });
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
    if (thumbnail.startsWith('//') || /https?:\/\//.test(thumbnail)) {
        return thumbnail;
    }
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
        field = getListFieldItems(field);
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

function validateAndExtendContentModels(config: any): ConfigValidationResult {
    const contentModels = config.contentModels ?? {};
    const models = config.models ?? {};

    const externalModels = !isGitCMS(config);
    const emptyContentModels = _.isEmpty(contentModels);

    if (externalModels || emptyContentModels) {
        return {
            valid: true,
            value: config,
            errors: []
        };
    }

    const validationResult = validateContentModels(contentModels, models);

    if (_.isEmpty(models)) {
        return {
            valid: validationResult.valid,
            value: config,
            errors: validationResult.errors
        };
    }

    const extendedModels = _.mapValues(models, (model, modelName) => {
        const contentModel = validationResult.value.contentModels[modelName];
        if (!contentModel) {
            return model;
        }
        if (_.get(contentModel, '__metadata.invalid')) {
            return model;
        }
        if (contentModel.isPage && (!model.type || ['object', 'page'].includes(model.type))) {
            return {
                type: 'page',
                ...(contentModel.newFilePath ? { filePath: contentModel.newFilePath } : {}),
                ..._.omit(contentModel, ['isPage', 'newFilePath']),
                ..._.omit(model, 'type')
            };
        } else if (!contentModel.isPage && (!model.type || ['object', 'data'].includes(model.type))) {
            return {
                type: 'data',
                ...(contentModel.newFilePath ? { filePath: contentModel.newFilePath } : {}),
                ..._.omit(contentModel, ['isPage', 'newFilePath']),
                ..._.omit(model, 'type')
            };
        } else {
            return model;
        }
    });

    return {
        valid: validationResult.valid,
        value: {
            ...config,
            models: extendedModels
        },
        errors: validationResult.errors
    };
}

function normalizeValidationResult(validationResult: ConfigValidationResult): NormalizedValidationResult {
    validationResult = filterAndOrderConfigFields(validationResult);
    convertModelGroupsToModelList(validationResult);
    return convertModelsToArray(validationResult);
}

function filterAndOrderConfigFields(validationResult: ConfigValidationResult): ConfigValidationResult {
    // TODO: see if we move filtering and sorting to Joi
    return {
        ...validationResult,
        value: _.pick(validationResult.value, [
            'stackbitVersion',
            'ssgName',
            'ssgVersion',
            'cmsName',
            'import',
            'buildCommand',
            'publishDir',
            'nodeVersion',
            'devCommand',
            'staticDir',
            'uploadDir',
            'assets',
            'pagesDir',
            'dataDir',
            'pageLayoutKey',
            'objectTypeKey',
            'styleObjectModelName',
            'excludePages',
            'logicFields',
            'contentModels',
            'modelsSource',
            'models',
            'presets'
        ])
    };
}

function convertModelGroupsToModelList(validationResult: ConfigValidationResult) {
    const models = validationResult.value?.models ?? {};

    const groupMap = _.reduce(
        models,
        (groupMap, model, modelName) => {
            if (!model.groups) {
                return groupMap;
            }
            const key = model?.type === 'object' ? 'objectModels' : 'documentModels';
            _.forEach(model.groups, (groupName) => {
                append(groupMap, [groupName, key], modelName);
            });
            delete model.groups;
            return groupMap;
        },
        {} as Record<string, { objectModels?: string[]; documentModels?: string[] }>
    );

    // update groups to have unique model names
    _.forEach(groupMap, (group) => {
        _.forEach(group, (modelGroup, key) => {
            _.set(group, key, _.uniq(modelGroup));
        });
    });

    _.forEach(models, (model) => {
        iterateModelFieldsRecursively(model, (field: any) => {
            if (isListField(field)) {
                field = field.items;
            }
            if (field.groups) {
                let key: string | null = null;
                if (isModelField(field)) {
                    key = 'objectModels';
                } else if (isReferenceField(field)) {
                    key = 'documentModels';
                }
                if (key) {
                    field.models = _.reduce(
                        field.groups,
                        (modelNames, groupName) => {
                            const objectModelNames = _.get(groupMap, [groupName, key], []);
                            return _.uniq(modelNames.concat(objectModelNames));
                        },
                        field.models || []
                    );
                }
                delete field.groups;
            }
        });
    });
}

function convertModelsToArray(validationResult: ConfigValidationResult): NormalizedValidationResult {
    const config = validationResult.value;

    // in stackbit.yaml 'models' are defined as object where keys are the model names,
    // convert 'models' to array of objects and set their 'name' property to the
    // model name
    const modelMap = config.models ?? {};
    const modelArray: Model[] = _.map(
        modelMap,
        (yamlModel: YamlModel, modelName: string): Model => {
            return {
                name: modelName,
                ...yamlModel
            };
        }
    );

    if (!isGitCMS(config)) {
        addImageModel(modelArray);
    }

    const convertedErrors = _.map(validationResult.errors, (error: ConfigValidationError) => {
        if (error.fieldPath[0] === 'models' && typeof error.fieldPath[1] == 'string') {
            const modelName = error.fieldPath[1];
            const modelIndex = _.findIndex(modelArray, { name: modelName });
            const normFieldPath = error.fieldPath.slice();
            normFieldPath[1] = modelIndex;
            error.normFieldPath = normFieldPath;
        }
        return error;
    });

    return {
        valid: validationResult.valid,
        config: {
            ...config,
            models: modelArray
        },
        errors: convertedErrors
    };
}

function addImageModel(models: Model[]) {
    models.push({
        type: 'image',
        name: '__image_model',
        label: 'Image',
        labelField: 'title',
        fields: [
            { name: 'title', type: 'string' },
            { name: 'url', type: 'string' }
        ]
    });
}

function isGitCMS(config: any) {
    return !config.cmsName || config.cmsName === 'git';
}
