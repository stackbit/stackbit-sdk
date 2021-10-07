import Joi from 'joi';
import _ from 'lodash';
import { append } from '@stackbit/utils';
import { CMS_NAMES, FIELD_TYPES, SSG_NAMES } from './config-consts';
import {
    Assets,
    ContentfulImport,
    Field,
    FieldObjectProps,
    ModelsSource,
    SanityImport,
    YamlBaseModel,
    YamlConfig,
    YamlConfigModel,
    YamlDataModel,
    YamlModel,
    ModelMap,
    YamlPageModel,
    FieldGroupItem,
    YamlObjectModel,
    ContentModelMap,
    ContentModel
} from './config-types';

function getConfigFromValidationState(state: Joi.State): YamlConfig {
    return _.last(state.ancestors)!;
}

function getModelsFromValidationState(state: Joi.State): ModelMap {
    const config = getConfigFromValidationState(state);
    return config.models ?? {};
}

const fieldNamePattern = /^[a-zA-Z0-9]([a-zA-Z0-9_-]*[a-zA-Z0-9])?$/;
const fieldNameError =
    'Invalid field name "{{#value}}" at "{{#label}}". A field name must contain only alphanumeric characters, ' +
    'hyphens and underscores, must start and end with an alphanumeric character.';
const fieldNameSchema = Joi.string()
    .required()
    .pattern(fieldNamePattern)
    .prefs({
        messages: { 'string.pattern.base': fieldNameError },
        errors: { wrap: { label: false } }
    });

const objectModelNameErrorCode = 'model.not.object.model';
const validObjectModelNames = Joi.custom((value, { error, state }) => {
    const models = getModelsFromValidationState(state);
    const modelNames = Object.keys(models);
    const objectModelNames = modelNames.filter((modelName) => models[modelName]!.type === 'object');
    if (!objectModelNames.includes(value)) {
        return error(objectModelNameErrorCode);
    }
    return value;
}).prefs({
    messages: {
        [objectModelNameErrorCode]: '{{#label}} must reference the name of an existing model of type "object", got "{{#value}}"'
    },
    errors: { wrap: { label: false } }
});

const documentModelNameErrorCode = 'model.not.document.model';
const validReferenceModelNames = Joi.custom((value, { error, state }) => {
    const models = getModelsFromValidationState(state);
    const modelNames = Object.keys(models);
    const documentModels = modelNames.filter((modelName) => ['page', 'data'].includes(models[modelName]!.type));
    if (!documentModels.includes(value)) {
        return error(documentModelNameErrorCode);
    }
    return value;
}).prefs({
    messages: {
        [documentModelNameErrorCode]: '{{#label}} must reference the name of an existing model of type "page" or "data", got "{{#value}}"'
    },
    errors: { wrap: { label: false } }
});

const groupNotFoundErrorCode = 'group.not.found';
const groupNotObjectModelErrorCode = 'group.not.object.model';
const validModelFieldGroups = Joi.string()
    .custom((group, { error, state }) => {
        const config = getConfigFromValidationState(state);
        const groupModels = getModelNamesForGroup(group, config);
        if (!_.isEmpty(groupModels.documentModels)) {
            return error(groupNotObjectModelErrorCode, { nonObjectModels: groupModels.documentModels.join(', ') });
        }
        if (_.isEmpty(groupModels.objectModels)) {
            return error(groupNotFoundErrorCode);
        }
        return group;
    })
    .prefs({
        messages: {
            [groupNotObjectModelErrorCode]:
                '{{#label}} of a "model" field must reference a group with only models ' +
                'of type "object", the "{{#value}}" group includes models of type "page" or "data" ({{#nonObjectModels}})',
            [groupNotFoundErrorCode]: '{{#label}} of a "model" field must reference the name of an existing group, got "{{#value}}"'
        },
        errors: { wrap: { label: false } }
    });

const groupNotDocumentModelErrorCode = 'group.not.document.model';
const validReferenceFieldGroups = Joi.string()
    .custom((group, { error, state }) => {
        const config = getConfigFromValidationState(state);
        const groupModels = getModelNamesForGroup(group, config);
        if (!_.isEmpty(groupModels.objectModels)) {
            return error(groupNotDocumentModelErrorCode, { nonDocumentModels: groupModels.objectModels.join(', ') });
        }
        if (_.isEmpty(groupModels.documentModels)) {
            return error(groupNotFoundErrorCode);
        }
        return group;
    })
    .prefs({
        messages: {
            [groupNotDocumentModelErrorCode]:
                '{{#label}} of a "reference" field must reference a group with only models of type "page" or "data", ' +
                'the "{{#value}}" group includes models of type "object" ({{#nonDocumentModels}})',
            [groupNotFoundErrorCode]: '{{#label}} of a "reference" field must reference the name of an existing group, got "{{#value}}"'
        },
        errors: { wrap: { label: false } }
    });

function getModelNamesForGroup(group: string, config: YamlConfig) {
    const models = config.models ?? {};
    return _.reduce(
        models,
        (result: { objectModels: string[]; documentModels: string[] }, model, modelName) => {
            if (model?.groups && _.includes(model.groups, group)) {
                if (model?.type === 'object') {
                    result.objectModels.push(modelName);
                } else {
                    result.documentModels.push(modelName);
                }
            }
            return result;
        },
        { objectModels: [], documentModels: [] }
    );
}

const logicField = Joi.string();
// TODO: validate that all logicFields reference existing fields
// const logicField = Joi.custom((value) => {
//     return value;
// });

const labelFieldNotFoundError = 'labelField.not.found';
const labelFieldNotSimple = 'labelField.not.simple';
const labelFieldSchema = Joi.custom((value, { error, state }) => {
    const modelOrObjectField: YamlBaseModel | FieldObjectProps = _.head(state.ancestors)!;
    const fields = modelOrObjectField?.fields ?? [];
    if (!_.isArray(fields)) {
        return error(labelFieldNotFoundError);
    }
    const field = _.find(fields, (field) => field.name === value);
    if (!field) {
        return error(labelFieldNotFoundError);
    }
    if (['object', 'model', 'reference', 'list'].includes(field.type)) {
        return error(labelFieldNotSimple, { fieldType: field.type });
    }
    return value;
}).prefs({
    messages: {
        [labelFieldNotFoundError]: '{{#label}} must be one of model field names, got "{{#value}}"',
        [labelFieldNotSimple]: '{{#label}} can not reference complex field, got "{{#value}}" field of type "{{#fieldType}}"'
    },
    errors: { wrap: { label: false } }
});

const variantFieldNotFoundError = 'variantField.not.found';
const variantFieldNotEnum = 'variantField.not.enum';
const variantFieldSchema = Joi.custom((value, { error, state }) => {
    const modelOrObjectField: YamlBaseModel | FieldObjectProps = _.head(state.ancestors)!;
    const fields = modelOrObjectField?.fields ?? [];
    if (!_.isArray(fields)) {
        return error(variantFieldNotFoundError);
    }
    const field = _.find(fields, (field) => field.name === value);
    if (!field) {
        return error(variantFieldNotFoundError);
    }
    if (field.type !== 'enum') {
        return error(variantFieldNotEnum, { fieldType: field.type });
    }
    return value;
}).prefs({
    messages: {
        [variantFieldNotFoundError]: '{{#label}} must be one of model field names, got "{{#value}}"',
        [variantFieldNotEnum]: '{{#label}} should reference "enum" field, got "{{#value}}" field of type "{{#fieldType}}"'
    },
    errors: { wrap: { label: false } }
});

const styleObjectModelReferenceError = 'styleObjectModelName.model.missing';
const styleObjectModelNotObject = 'styleObjectModelName.model.type';
const styleObjectModelNameSchema = Joi.string()
    .allow('', null)
    .custom((value, { error, state }) => {
        const models = getModelsFromValidationState(state);
        const modelNames = Object.keys(models);
        if (!modelNames.includes(value)) {
            return error(styleObjectModelReferenceError);
        }
        if (models[value]!.type !== 'data') {
            return error(styleObjectModelNotObject);
        }
        return value;
    })
    .prefs({
        messages: {
            [styleObjectModelReferenceError]: '{{#label}} must reference an existing model',
            [styleObjectModelNotObject]: 'Model defined in {{#label}} must be of type data - {{#value}}'
        },
        errors: { wrap: { label: false } }
    });

const contentfulImportSchema = Joi.object<ContentfulImport>({
    type: Joi.string().valid('contentful').required(),
    contentFile: Joi.string().required(),
    uploadAssets: Joi.boolean(),
    assetsDirectory: Joi.string(),
    spaceIdEnvVar: Joi.string(),
    accessTokenEnvVar: Joi.string()
}).and('uploadAssets', 'assetsDirectory');

const sanityImportSchema = Joi.object<SanityImport>({
    type: Joi.string().valid('sanity').required(),
    contentFile: Joi.string().required(),
    sanityStudioPath: Joi.string().required(),
    deployStudio: Joi.boolean(),
    deployGraphql: Joi.boolean(),
    projectIdEnvVar: Joi.string(),
    datasetEnvVar: Joi.string(),
    tokenEnvVar: Joi.string()
});

const importSchema = Joi.alternatives().conditional('.type', {
    switch: [
        { is: 'contentful', then: contentfulImportSchema },
        { is: 'sanity', then: sanityImportSchema }
    ]
});

const modelsSourceSchema = Joi.object<ModelsSource>({
    type: 'files',
    modelDirs: Joi.array().items(Joi.string()).required()
});

const assetsSchema = Joi.object<Assets>({
    referenceType: Joi.string().valid('static', 'relative').required(),
    assetsDir: Joi.string().allow('').when('referenceType', {
        is: 'relative',
        then: Joi.required()
    }),
    staticDir: Joi.string().allow('').when('referenceType', {
        is: 'static',
        then: Joi.required()
    }),
    publicPath: Joi.string().allow('').when('referenceType', {
        is: 'static',
        then: Joi.required()
    }),
    uploadDir: Joi.string().allow('')
});

const fieldGroupsSchema = Joi.array()
    .items(
        Joi.object<FieldGroupItem>({
            name: Joi.string().required(),
            label: Joi.string().required()
        })
    )
    .unique('name')
    .prefs({
        messages: {
            'array.unique': '{{#label}} contains a duplicate group name "{{#value.name}}"'
        },
        errors: { wrap: { label: false } }
    });

const inGroups = Joi.string()
    .valid(
        // 4 dots "...." =>
        //   ".." for the parent field where "group" property is defined
        //   + "." for the fields array
        //   + "." for the parent model
        Joi.in('....fieldGroups', {
            adjust: (groups) => (_.isArray(groups) ? groups.map((group) => group.name) : [])
        })
    )
    .prefs({
        messages: { 'any.only': '{{#label}} must be one of model field groups, got "{{#value}}"' },
        errors: { wrap: { label: false } }
    });

const fieldCommonPropsSchema = Joi.object({
    type: Joi.string()
        .valid(...FIELD_TYPES)
        .required(),
    name: fieldNameSchema,
    label: Joi.string(),
    description: Joi.string().allow(''),
    required: Joi.boolean(),
    default: Joi.any(),
    group: inGroups,
    const: Joi.any(),
    hidden: Joi.boolean(),
    readOnly: Joi.boolean()
}).oxor('const', 'default');

const numberFieldPartialSchema = Joi.object({
    type: Joi.string().valid('number').required(),
    subtype: Joi.string().valid('int', 'float'),
    min: Joi.number(),
    max: Joi.number(),
    step: Joi.number()
});

const enumFieldBaseOptionSchema = Joi.object({
    label: Joi.string().required(),
    value: Joi.alternatives().try(Joi.string(), Joi.number()).required()
});

const enumFieldPartialSchema = Joi.object({
    type: Joi.string().valid('enum').required(),
    controlType: Joi.string().valid('dropdown', 'button-group', 'thumbnails', 'palette'),
    options: Joi.any()
        .when('..controlType', {
            switch: [
                {
                    is: 'thumbnails',
                    then: Joi.array().items(
                        enumFieldBaseOptionSchema.append({
                            thumbnail: Joi.string().required()
                        })
                    )
                },
                {
                    is: 'palette',
                    then: Joi.array().items(
                        enumFieldBaseOptionSchema.append({
                            textColor: Joi.string(),
                            backgroundColor: Joi.string(),
                            borderColor: Joi.string()
                        })
                    )
                }
            ],
            otherwise: Joi.alternatives().try(Joi.array().items(Joi.string(), Joi.number()), Joi.array().items(enumFieldBaseOptionSchema))
        })
        .required()
        .prefs({
            messages: {
                'alternatives.types': '{{#label}} must be an array of strings or numbers, or an array of objects with label and value properties',
                'alternatives.match': '{{#label}} must be an array of strings or numbers, or an array of objects with label and value properties'
            },
            errors: { wrap: { label: false } }
        })
});

const objectFieldPartialSchema = Joi.object({
    type: Joi.string().valid('object').required(),
    labelField: labelFieldSchema,
    thumbnail: Joi.string(),
    variantField: variantFieldSchema,
    fieldGroups: fieldGroupsSchema,
    fields: Joi.link('#fieldsSchema').required()
});

const modelFieldPartialSchema = Joi.object({
    type: Joi.string().valid('model').required(),
    models: Joi.array().items(validObjectModelNames).when('groups', {
        not: Joi.exist(),
        then: Joi.required()
    }),
    groups: Joi.array().items(validModelFieldGroups)
});

const referenceFieldPartialSchema = Joi.object({
    type: Joi.string().valid('reference').required(),
    models: Joi.array().items(validReferenceModelNames).when('groups', {
        not: Joi.exist(),
        then: Joi.required()
    }),
    groups: Joi.array().items(validReferenceFieldGroups)
});

const partialFieldSchema = Joi.object().when('.type', {
    switch: [
        { is: 'number', then: numberFieldPartialSchema },
        { is: 'enum', then: enumFieldPartialSchema },
        { is: 'object', then: objectFieldPartialSchema },
        { is: 'model', then: modelFieldPartialSchema },
        { is: 'reference', then: referenceFieldPartialSchema }
    ]
});

const listItemsSchema = Joi.object({
    type: Joi.string()
        .valid(..._.without(FIELD_TYPES, 'list'))
        .required()
}).concat(partialFieldSchema);

const listFieldPartialSchema = Joi.object({
    type: Joi.string().valid('list').required(),
    items: listItemsSchema
});

const partialFieldWithListSchema = partialFieldSchema.when('.type', {
    is: 'list',
    then: listFieldPartialSchema
});

const fieldSchema: Joi.ObjectSchema<Field> = fieldCommonPropsSchema.concat(partialFieldWithListSchema);

const fieldsSchema = Joi.array().items(fieldSchema).unique('name').id('fieldsSchema');

const contentModelKeyNotFound = 'contentModel.model.not.found';
const contentModelTypeNotPage = 'contentModel.type.not.page';
const contentModelTypeNotData = 'contentModel.type.not.data';
const contentModelSchema = Joi.object<ContentModel>({
    isPage: Joi.boolean(),
    newFilePath: Joi.string(),
    file: Joi.string(),
    folder: Joi.string(),
    match: Joi.array().items(Joi.string()).single(),
    exclude: Joi.array().items(Joi.string()).single()
})
    .without('file', ['folder', 'match', 'exclude'])
    .when('.isPage', {
        is: true,
        then: Joi.object({
            urlPath: Joi.string(),
            hideContent: Joi.boolean()
        })
    })
    .custom((contentModel, { error, state, prefs }) => {
        const models = _.get(prefs, 'context.models');
        if (!models) {
            return contentModel;
        }
        const modelName = _.last(state.path)!;
        const model = models[modelName];
        if (!model) {
            return error(contentModelKeyNotFound, { modelName });
        } else if (contentModel.isPage && model.type && !['page', 'object'].includes(model.type)) {
            return error(contentModelTypeNotPage, { modelName, modelType: model.type });
        } else if (!contentModel.isPage && model.type && !['data', 'object'].includes(model.type)) {
            return error(contentModelTypeNotData, { modelName, modelType: model.type });
        }
        return contentModel;
    })
    .prefs({
        messages: {
            [contentModelKeyNotFound]: 'The key "{{#modelName}}" of contentModels must reference the name of an existing model',
            [contentModelTypeNotPage]:
                'The contentModels.{{#modelName}}.isPage is set to true, but the "{{#modelName}}" model\'s type is "{{#modelType}}". ' +
                'The contentModels should reference models of "object" type only. ' +
                'Set the "{{#modelName}}" model\'s type property to "object" or delete it use the default "object"',
            [contentModelTypeNotData]:
                'The contentModels.{{#modelName}} references a model of type "{{#modelType}}". ' +
                'The contentModels should reference models of "object" type only. ' +
                'Set the "{{#modelName}}" model\'s type property to "object" or delete it use the default "object"'
        },
        errors: { wrap: { label: false } }
    });

export const contentModelsSchema = Joi.object({
    contentModels: Joi.object<ContentModelMap>().pattern(Joi.string(), contentModelSchema)
});

const baseModelSchema = Joi.object<YamlBaseModel>({
    __metadata: Joi.object({
        filePath: Joi.string()
    }),
    type: Joi.string().valid('page', 'data', 'config', 'object').required(),
    label: Joi.string().required().when(Joi.ref('/import'), {
        is: Joi.exist(),
        then: Joi.optional()
    }),
    description: Joi.string(),
    thumbnail: Joi.string(),
    extends: Joi.array().items(validObjectModelNames).single(),
    labelField: labelFieldSchema,
    variantField: variantFieldSchema,
    groups: Joi.array().items(Joi.string()),
    fieldGroups: fieldGroupsSchema,
    fields: Joi.link('#fieldsSchema')
});

const objectModelSchema: Joi.ObjectSchema<YamlObjectModel> = baseModelSchema.concat(
    Joi.object({
        type: Joi.string().valid('object').required()
    })
);

const dataModelSchema: Joi.ObjectSchema<YamlDataModel> = baseModelSchema
    .concat(
        Joi.object({
            type: Joi.string().valid('data').required(),
            filePath: Joi.string(),
            file: Joi.string(),
            folder: Joi.string(),
            match: Joi.array().items(Joi.string()).single(),
            exclude: Joi.array().items(Joi.string()).single(),
            isList: Joi.boolean()
        })
    )
    .when('.isList', {
        is: true,
        then: Joi.object({
            items: listItemsSchema.required(),
            fields: Joi.forbidden()
        })
    })
    .when('.file', {
        is: Joi.exist(),
        then: Joi.object({
            folder: Joi.forbidden(),
            match: Joi.forbidden(),
            exclude: Joi.forbidden()
        })
    });

const configModelSchema: Joi.ObjectSchema<YamlConfigModel> = baseModelSchema.concat(
    Joi.object({
        type: Joi.string().valid('config').required(),
        file: Joi.string()
    })
);

const pageModelSchema: Joi.ObjectSchema<YamlPageModel> = baseModelSchema
    .concat(
        Joi.object({
            type: Joi.string().valid('page').required(),
            layout: Joi.string(), //.when(Joi.ref('/pageLayoutKey'), { is: Joi.string().exist(), then: Joi.required() }),
            urlPath: Joi.string(),
            filePath: Joi.string(),
            singleInstance: Joi.boolean(),
            file: Joi.string(),
            folder: Joi.string(),
            match: Joi.array().items(Joi.string()).single(),
            exclude: Joi.array().items(Joi.string()).single(),
            hideContent: Joi.boolean()
        })
    )
    .when('.file', {
        is: Joi.exist(),
        then: {
            singleInstance: Joi.valid(true).required(),
            folder: Joi.forbidden(),
            match: Joi.forbidden(),
            exclude: Joi.forbidden()
        }
    })
    .when('.singleInstance', { is: true, then: { file: Joi.required() } });

const modelSchema = Joi.object<YamlModel>({
    type: Joi.string().valid('page', 'data', 'config', 'object').required()
}).when('.type', {
    switch: [
        { is: 'object', then: objectModelSchema },
        { is: 'data', then: dataModelSchema },
        { is: 'config', then: configModelSchema },
        { is: 'page', then: pageModelSchema }
    ]
});

const modelNamePattern = /^[a-zA-Z]([a-zA-Z0-9_]*[a-zA-Z0-9])?$/;
const modelNamePatternMatchErrorCode = 'model.name.pattern.match';
const modelFileExclusiveErrorCode = 'model.file.only';
const modelIsListItemsRequiredErrorCode = 'model.isList.items.required';
const modelIsListFieldsForbiddenErrorCode = 'model.isList.fields.forbidden';
const modelListForbiddenErrorCode = 'model.items.forbidden';
const fieldNameUnique = 'field.name.unique';
const groupModelsIncompatibleError = 'group.models.incompatible';

const modelsSchema = Joi.object<ModelMap>()
    .pattern(modelNamePattern, modelSchema)
    .custom((models: ModelMap, { error }) => {
        const groupMap: Record<string, Record<'objectModels' | 'documentModels', string[]>> = {};

        _.forEach(models, (model, modelName) => {
            const key = model?.type === 'object' ? 'objectModels' : 'documentModels';
            _.forEach(model.groups, (groupName) => {
                append(groupMap, [groupName, key], modelName);
            });
        });

        const errors = _.reduce(
            groupMap,
            (errors: string[], group, groupName) => {
                if (group.objectModels && group.documentModels) {
                    const objectModels = group.objectModels.join(', ');
                    const documentModels = group.documentModels.join(', ');
                    errors.push(
                        `group "${groupName}" include models of type "object" (${objectModels}) and objects of type "page" or "data" (${documentModels})`
                    );
                }
                return errors;
            },
            []
        );

        if (!_.isEmpty(errors)) {
            return error(groupModelsIncompatibleError, { incompatibleGroups: errors.join(', ') });
        }

        return models;
    })
    .error(((errors: Joi.ErrorReport[]): Joi.ErrorReport[] => {
        return _.map(errors, (error) => {
            if (error.code === 'object.unknown' && error.path.length === 2 && error.path[0] === 'models') {
                error.code = modelNamePatternMatchErrorCode;
            } else if (
                error.code === 'any.unknown' &&
                error.path.length === 3 &&
                error.path[0] === 'models' &&
                error.path[2] &&
                ['folder', 'match', 'exclude'].includes(error.path[2])
            ) {
                error.code = modelFileExclusiveErrorCode;
            } else if (error.code === 'any.required' && error.path.length === 3 && error.path[0] === 'models' && error.path[2] === 'items') {
                error.code = modelIsListItemsRequiredErrorCode;
            } else if (error.code === 'any.unknown' && error.path.length === 3 && error.path[0] === 'models' && error.path[2] === 'fields') {
                error.code = modelIsListFieldsForbiddenErrorCode;
            } else if (error.code === 'object.unknown' && error.path.length === 3 && error.path[0] === 'models' && error.path[2] === 'items') {
                error.code = modelListForbiddenErrorCode;
            } else if (error.code === 'array.unique' && error.path.length > 3 && error.path[0] === 'models' && _.nth(error.path, -2) === 'fields') {
                error.code = fieldNameUnique;
            }
            return error;
        });
    }) as any) // the type definition of Joi.ValidationErrorFunction is wrong, so we override
    .prefs({
        messages: {
            [groupModelsIncompatibleError]:
                'Model groups must include models of the same type. The following groups have incompatible models: {{#incompatibleGroups}}',
            [modelNamePatternMatchErrorCode]:
                'Invalid model name "{{#key}}" at "{{#label}}". A model name must contain only alphanumeric characters ' +
                'and underscores, must start with a letter, and end with alphanumeric character.',
            [modelFileExclusiveErrorCode]: '{{#label}} cannot be used with "file"',
            [modelIsListItemsRequiredErrorCode]: '{{#label}} is required when "isList" is true',
            [modelIsListFieldsForbiddenErrorCode]: '{{#label}} is not allowed when "isList" is true',
            [modelListForbiddenErrorCode]: '{{#label}} is not allowed when "isList" is not true',
            [fieldNameUnique]: '{{#label}} contains a duplicate field name "{{#value.name}}"'
        },
        errors: { wrap: { label: false } }
    });

export const stackbitConfigSchema = Joi.object<YamlConfig>({
    stackbitVersion: Joi.string().required(),
    ssgName: Joi.string().valid(...SSG_NAMES),
    ssgVersion: Joi.string(),
    nodeVersion: Joi.string(),
    devCommand: Joi.string(),
    cmsName: Joi.string().valid(...CMS_NAMES),
    import: importSchema,
    buildCommand: Joi.string(),
    publishDir: Joi.string(),
    staticDir: Joi.string().allow(''),
    uploadDir: Joi.string(),
    assets: assetsSchema,
    pagesDir: Joi.string().allow('', null),
    dataDir: Joi.string().allow('', null),
    pageLayoutKey: Joi.string().allow(null),
    objectTypeKey: Joi.string(),
    styleObjectModelName: styleObjectModelNameSchema,
    excludePages: Joi.array().items(Joi.string()).single(),
    logicFields: Joi.array().items(logicField),
    contentModels: Joi.any(),
    modelsSource: modelsSourceSchema,
    models: modelsSchema
})
    .unknown(true)
    .without('assets', ['staticDir', 'uploadDir'])
    .when('.cmsName', {
        is: ['contentful', 'sanity'],
        then: Joi.object({
            assets: Joi.forbidden(),
            staticDir: Joi.forbidden(),
            uploadDir: Joi.forbidden(),
            pagesDir: Joi.forbidden(),
            dataDir: Joi.forbidden(),
            excludePages: Joi.forbidden()
        })
    })
    .shared(fieldsSchema);
