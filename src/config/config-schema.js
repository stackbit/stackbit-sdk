const Joi = require('joi');
const _ = require('lodash');

// SSGs Stackbit Stuio supports
const SSG_NAMES = [
    'unibit', 'jekyll', 'hugo', 'gatsby', 'nextjs', 'custom', 'eleventy',
    'vuepress', 'gridsome' , 'nuxt', 'sapper', 'hexo'
];

// CMSes Stackbit Stuio supports
const CMS_NAMES = [
    'git', 'contentful', 'sanity', 'forestry', 'netlify'
];

const FIELD_TYPES = [
    'string', 'url', 'slug', 'text', 'markdown', 'html', 'number', 'boolean',
    'enum', 'date', 'datetime', 'color', 'image', 'file', 'json',  'object',
    'model', 'reference', 'list'
];

const fieldNamePattern = /^[a-zA-Z0-9]([a-zA-Z0-9_-]*[a-zA-Z0-9])?$/;
const fieldNameError = 'Invalid field name "{{#value}}" at "{{#label}}". A field name must contain only alphanumeric characters, hyphens and underscores, must start and end with an alphanumeric character.';
const fieldNameSchema = Joi.string().required().pattern(fieldNamePattern).prefs({
    messages: { 'string.pattern.base': fieldNameError },
    errors: { wrap: { label: false } }
});

const objectModelNameErrorCode = 'model.name.of.object.models';
const documentModelNameErrorCode = 'model.name.of.document.models';

const validObjectModelNames = Joi.custom((value, { error, state }) => {
    const models = _.last(state.ancestors).models;
    const modelNames = Object.keys(models);
    const objectModelNames = modelNames.filter(modelName => models[modelName].type === 'object');
    if (!objectModelNames.includes(value)) {
        return error(objectModelNameErrorCode);
    }
    return value;
});

const validPageOrDataModelNames = Joi.custom((value, { error, state }) => {
    const models = _.last(state.ancestors).models;
    const modelNames = Object.keys(models);
    const documentModels = modelNames.filter(modelName => ['page', 'data'].includes(models[modelName].type));
    if (!documentModels.includes(value)) {
        return error(documentModelNameErrorCode);
    }
    return value;
});

const logicFields = Joi.custom((value) => {
    // TODO: validate that all logicFields reference existing fields
    return value;
});

const inFields = Joi.string().valid(Joi.in('fields', {
    adjust: (fields) => _.isArray(fields) ? fields.map(field => field.name) : []
})).prefs({
    messages: { 'any.only': '"{{#label}}" must be one of model field names, got "{{#value}}"' },
    errors: { wrap: { label: false } }
});

const ContentfulImport = Joi.object({
    type: Joi.string().valid('contentful').required(),
    contentFile: Joi.string().required(),
    spaceIdEnvVar: Joi.string(),
    accessTokenEnvVar: Joi.string()
});

const Import = Joi.alternatives().conditional('.type', {
    switch: [
        { is: 'contentful', then: ContentfulImport }
    ]
})

const AssetsModel = Joi.object({
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
    uploadDir: Joi.string().allow(''),
});

const SharedFieldSchema = Joi.object({
    options: Joi.array().when('type', {
        is: 'enum',
        then: Joi.required(),
        otherwise: Joi.forbidden()
    }),
    labelField: Joi.string().when('type', {
        is: 'object',
        then: inFields,
        otherwise: Joi.forbidden()
    }),
    subtype: Joi.string().valid('int', 'float').when('type', {
        not: 'number',
        then: Joi.forbidden()
    }),
    fields: Joi.when('type', {
        is: 'object',
        then: Joi.array().items(Joi.link('#field')).required().unique('name'),
        otherwise: Joi.forbidden()
    }),
    models: Joi.when('type', {
        switch: [
            {
                is: 'model',
                then: Joi.array().items(validObjectModelNames).required()
            },
            {
                is: 'reference',
                then: Joi.array().items(validPageOrDataModelNames).required()
            }
        ],
        otherwise: Joi.forbidden()
    })
});

const ListField = SharedFieldSchema.concat(Joi.object({
    type: Joi.string().valid(..._.without(FIELD_TYPES, 'list')).optional(),
}));

const Field = SharedFieldSchema.concat(Joi.object({
    type: Joi.string().valid(...FIELD_TYPES).required(),
    name: fieldNameSchema,
    label: Joi.string(),
    description: Joi.string().allow(''),
    required: Joi.boolean(),
    default: Joi.any(),
    const: Joi.any(),
    hidden: Joi.boolean(),
    readOnly: Joi.boolean(),
    items: Joi.when('type', {
        is: 'list',
        then: ListField,
        otherwise: Joi.forbidden()
    })
}).oxor('const', 'default')).id('field');

const BaseModel = Joi.object({
    type: Joi.string().valid('page', 'data', 'config', 'object').required(),
    label: Joi.string().required(),
    description: Joi.string(),
    extends: Joi.array().items(validObjectModelNames).single(),
    labelField: inFields,
    fields: Joi.array().items(Field).unique('name'),
});

const ObjectModel = BaseModel.concat(Joi.object({
    type: Joi.string().valid('object').required()
}));

const DataModel = BaseModel.concat(Joi.object({
    type: Joi.string().valid('data', 'config').required(),
    file: Joi.string(),
    folder: Joi.string(),
    match: Joi.array().items(Joi.string()).single(),
    exclude: Joi.array().items(Joi.string()).single(),
    isList: Joi.boolean(),
    items: ListField,
})).when('.isList', {
    is: true,
    then: Joi.object({
        items: Joi.required(),
        fields: Joi.forbidden()
    }),
    otherwise: Joi.object({
        items: Joi.forbidden()
    })
}).when('.file', {
    is: Joi.exist(),
    then: Joi.object({
        folder: Joi.forbidden(),
        match: Joi.forbidden(),
        exclude: Joi.forbidden()
    })
});

const PageModel = BaseModel.concat(Joi.object({
    type: Joi.string().valid('page').required(),
    layout: Joi.string().when(Joi.ref('/pageLayoutKey'), { is: Joi.exist(), then: Joi.required() }),
    urlPath: Joi.string(),
    filePath: Joi.string(),
    singleInstance: Joi.boolean(),
    file: Joi.string(),
    folder: Joi.string(),
    match: Joi.array().items(Joi.string()).single(),
    exclude: Joi.array().items(Joi.string()).single(),
    hideContent: Joi.boolean(),
}))
    .when('.file', {
        is: Joi.exist(),
        then: {
            singleInstance: Joi.valid(true).required(),
            folder: Joi.forbidden(),
            match: Joi.forbidden(),
            exclude: Joi.forbidden()
        }
    })
    .when('.singleInstance', {is: true, then: { file: Joi.required() }})

const Model = Joi.object({
    type: Joi.string().valid('page', 'data', 'config', 'object').required()
}).when('.type', {
    switch: [
        { is: 'object', then: ObjectModel },
        { is: ['data', 'config'], then: DataModel },
        { is: 'page', then: PageModel }
    ]
});

const modelNamePattern = /^[a-z]([a-z0-9_]*[a-z0-9])?$/;
const modelNamePatternMatchErrorCode = 'model.name.pattern.match';
const modelFileExclusiveErrorCode = 'model.file.only';
const modelIsListItemsRequiredErrorCode = 'model.isList.items.required';
const modelIsListFieldsForbiddenErrorCode = 'model.isList.fields.forbidden';
const modelListForbiddenErrorCode = 'model.items.forbidden';
const fieldNameUnique = 'field.name.unique';


const Models = Joi.object().pattern(modelNamePattern, Model).error((errors) => {
    return _.map(errors, (error) => {
        if (error.code === 'object.unknown' && error.path.length === 2 && error.path[0] === 'models') {
            error.code = modelNamePatternMatchErrorCode;
        } else if (error.code === 'any.unknown' && error.path.length === 3 && error.path[0] === 'models' && ['folder', 'match', 'exclude'].includes(error.path[2])) {
            error.code = modelFileExclusiveErrorCode;
        } else if (error.code === 'any.required' && error.path.length === 3 && error.path[0] === 'models' && error.path[2] === 'items') {
            error.code = modelIsListItemsRequiredErrorCode;
        } else if (error.code === 'any.unknown' && error.path.length === 3 && error.path[0] === 'models' && error.path[2] === 'fields') {
            error.code = modelIsListFieldsForbiddenErrorCode;
        } else if (error.code === 'any.unknown' && error.path.length === 3 && error.path[0] === 'models' && error.path[2] === 'items') {
            error.code = modelListForbiddenErrorCode;
        } else if (error.code === 'array.unique' && error.path.length > 3 && error.path[0] === 'models' && _.nth(error.path, -2) === 'fields') {
            error.code = fieldNameUnique;
        }
        return error;
    });
}).prefs({
    messages: {
        [modelNamePatternMatchErrorCode]: 'Invalid model name "{{#key}}" at "{{#label}}". A model name must contain only lower case alphanumeric characters and underscores, must start with a lower case letter, and end with alphanumeric character.',
        [modelFileExclusiveErrorCode]: '{{#label}} can not be used with "file"',
        [modelIsListItemsRequiredErrorCode]: '{{#label}} is required when "isList" is true',
        [modelIsListFieldsForbiddenErrorCode]: '{{#label}} is not allowed when "isList" is true',
        [modelListForbiddenErrorCode]: '{{#label}} is not allowed when "isList" is not true',
        [objectModelNameErrorCode]: '"{{#label}}" must reference the name of an existing model of type "object", got "{{#value}}"',
        [documentModelNameErrorCode]: '"{{#label}}" must reference the name of an existing model of type "page" or "data", got "{{#value}}"',
        [fieldNameUnique]: '"{{#label}}" contains a duplicate field name "{{#value.name}}"'
    },
    errors: { wrap: { label: false } }
});

const schema = Joi.object({
    stackbitVersion: Joi.string().required(),
    ssgName: Joi.string().valid(...SSG_NAMES),
    ssgVersion: Joi.string(),
    cmsName: Joi.string().valid(...CMS_NAMES),
    import: Import,
    buildCommand: Joi.string(),
    publishDir: Joi.string(),
    staticDir: Joi.string().allow(''),
    uploadDir: Joi.string(),
    assets: AssetsModel,
    pagesDir: Joi.string().allow('', null),
    dataDir: Joi.string().allow('', null),
    pageLayoutKey: Joi.string().allow(null),
    objectTypeKey: Joi.string(),
    excludePages: Joi.array().items(Joi.string()).single(),
    logicFields: Joi.array().items(logicFields),
    models: Models
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

module.exports.stackbitConfigSchema = schema;
