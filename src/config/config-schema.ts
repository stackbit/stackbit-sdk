import Joi from 'joi';
import _ from 'lodash';

// SSGs Stackbit Stuio supports
const SSG_NAMES = ['unibit', 'jekyll', 'hugo', 'gatsby', 'nextjs', 'custom', 'eleventy', 'vuepress', 'gridsome', 'nuxt', 'sapper', 'hexo'] as const;

// CMSes Stackbit Stuio supports
const CMS_NAMES = ['git', 'contentful', 'sanity', 'forestry', 'netlify'] as const;

const FIELD_TYPES = [
    'string',
    'url',
    'slug',
    'text',
    'markdown',
    'html',
    'number',
    'boolean',
    'enum',
    'date',
    'datetime',
    'color',
    'image',
    'file',
    'json',
    'object',
    'model',
    'reference',
    'list'
] as const;

const fieldNamePattern = /^[a-zA-Z0-9]([a-zA-Z0-9_-]*[a-zA-Z0-9])?$/;
const fieldNameError =
    'Invalid field name "{{#value}}" at "{{#label}}". A field name must contain only alphanumeric characters, hyphens and underscores, must start and end with an alphanumeric character.';
const fieldNameSchema = Joi.string()
    .required()
    .pattern(fieldNamePattern)
    .prefs({
        messages: { 'string.pattern.base': fieldNameError },
        errors: { wrap: { label: false } }
    });

const objectModelNameErrorCode = 'model.name.of.object.models';
const documentModelNameErrorCode = 'model.name.of.document.models';

const validObjectModelNames = Joi.custom((value, { error, state }) => {
    const models = _.last<ISchema>(state.ancestors)!.models ?? {};
    const modelNames = Object.keys(models);
    const objectModelNames = modelNames.filter((modelName) => models[modelName]!.type === 'object');
    if (!objectModelNames.includes(value)) {
        return error(objectModelNameErrorCode);
    }
    return value;
});

const validPageOrDataModelNames = Joi.custom((value, { error, state }) => {
    const models = _.last<ISchema>(state.ancestors)!.models ?? {};
    const modelNames = Object.keys(models);
    const documentModels = modelNames.filter((modelName) => ['page', 'data'].includes(models[modelName]!.type));
    if (!documentModels.includes(value)) {
        return error(documentModelNameErrorCode);
    }
    return value;
});

// TODO: explain type
export type ILogicField = unknown;

const logicFields = Joi.custom((value) => {
    // TODO: validate that all logicFields reference existing fields
    return value;
});

const inFields = Joi.string()
    .valid(
        Joi.in('fields', {
            adjust: (fields) => (_.isArray(fields) ? fields.map((field) => field.name) : [])
        })
    )
    .prefs({
        messages: { 'any.only': '"{{#label}}" must be one of model field names, got "{{#value}}"' },
        errors: { wrap: { label: false } }
    });

export interface IContentfulImport {
    type: 'contentful';
    contentFile: string;
    spaceIdEnvVar?: string;
    accessTokenEnvVar?: string;
}

const ContentfulImport = Joi.object<IContentfulImport>({
    type: Joi.string().valid('contentful').required(),
    contentFile: Joi.string().required(),
    spaceIdEnvVar: Joi.string(),
    accessTokenEnvVar: Joi.string()
});

export type IImport = IContentfulImport | { type: '_undefined' };

const Import = Joi.alternatives().conditional('.type', {
    switch: [{ is: 'contentful', then: ContentfulImport }]
});

export interface IStaticAssetsModal {
    referenceType: 'static';
    assetsDir?: string;
    staticDir: string;
    publicPath: string;
    uploadDir?: string;
}

export interface IRelativeAssetsModal {
    referenceType: 'relative';
    assetsDir: string;
    staticDir?: string;
    publicPath?: string;
    uploadDir?: string;
}

export type IAssetsModel = IStaticAssetsModal | IRelativeAssetsModal;

const AssetsModel = Joi.object<IAssetsModel>({
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

export interface IFieldSchemaEnum {
    type: 'enum';
    options: unknown[];
}

export interface IFieldSchemaObject {
    type: 'object';
    labelField?: string;
    fields: IField[];
}

export interface IFieldSchemaList {
    type?: 'list';
    items?: IListField;
}

export interface IFieldSchemaNumber {
    type: 'number';
    subtype?: 'int' | 'float';
}

export interface IFieldSchemaModelOrReference {
    type: 'model' | 'reference';
    models: string[];
}

export interface IFieldSchemaOther {
    type?: Exclude<typeof FIELD_TYPES[number], 'enum' | 'object' | 'list' | 'number' | 'model' | 'reference'>;
}

export type IFieldSchema = IFieldSchemaEnum | IFieldSchemaObject | IFieldSchemaList | IFieldSchemaNumber | IFieldSchemaModelOrReference | IFieldSchemaOther;

export type IListField = Exclude<IFieldSchema, IFieldSchemaList>;

const ListField = SharedFieldSchema.concat(
    Joi.object({
        type: Joi.string()
            .valid(..._.without(FIELD_TYPES, 'list'))
            .optional()
    })
);

export interface IFieldCommon {
    name: string;
    label?: string;
    description?: string;
    required?: boolean;
    default?: unknown;
    const?: unknown;
    hidden?: boolean;
    readOnly?: boolean;
}

export type IField = IFieldSchema & IFieldCommon;

const Field: Joi.ObjectSchema<IField> = SharedFieldSchema.concat(
    Joi.object({
        type: Joi.string()
            .valid(...FIELD_TYPES)
            .required(),
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
    }).oxor('const', 'default')
).id('field');

export interface IBaseModel {
    label: string;
    description?: string;
    extends?: string | string[];
    labelField?: string;
    fields?: IField[];
}

const BaseModel = Joi.object({
    type: Joi.string().valid('page', 'data', 'config', 'object').required(),
    label: Joi.string().required(),
    description: Joi.string(),
    extends: Joi.array().items(validObjectModelNames).single(),
    labelField: inFields,
    fields: Joi.array().items(Field).unique('name')
});

export interface IObjectModel extends IBaseModel {
    type: 'object';
}

const ObjectModel = BaseModel.concat(
    Joi.object({
        type: Joi.string().valid('object').required()
    })
);

export interface IBaseDataModel extends IBaseModel {
    type: 'data' | 'config';
}

export interface IBaseDataModelFileSingle extends IBaseDataModel {
    file: string;
    isList?: false;
}

export interface IBaseDataModelFileList extends Omit<IBaseDataModel, 'fields'> {
    file: string;
    isList: true;
    items: IListField;
}

interface IBaseMatch {
    folder?: string;
    match?: string | string[];
    exclude?: string | string[];
}

export interface IBaseDataModelMatchSingle extends IBaseDataModel, IBaseMatch {
    file: undefined;
    isList?: false;
}

export interface IBaseDataModelMatchList extends Omit<IBaseDataModel, 'fields'>, IBaseMatch {
    file: undefined;
    isList: true;
    items: IListField;
}

export type IDataModel = IBaseDataModelFileSingle | IBaseDataModelFileList | IBaseDataModelMatchSingle | IBaseDataModelMatchList;

const DataModel: Joi.ObjectSchema<IDataModel> = BaseModel.concat(
    Joi.object({
        type: Joi.string().valid('data', 'config').required(),
        file: Joi.string(),
        folder: Joi.string(),
        match: Joi.array().items(Joi.string()).single(),
        exclude: Joi.array().items(Joi.string()).single(),
        isList: Joi.boolean(),
        items: ListField
    })
)
    .when('.isList', {
        is: true,
        then: Joi.object({
            items: Joi.required(),
            fields: Joi.forbidden()
        }),
        otherwise: Joi.object({
            items: Joi.forbidden()
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

export interface IBasePageModel extends IBaseModel {
    type: 'page';
    layout?: string;
    urlPath?: string;
    filePath?: string;
    hideContent?: boolean;
}

export interface IPageModelSingle extends IBasePageModel {
    singleInstance: true;
    file: string;
}

export interface IPageModelMatch extends IBasePageModel, IBaseMatch {
    singleInstance?: false;
    file: undefined;
}

export type IPageModel = IPageModelSingle | IPageModelMatch;

const PageModel: Joi.ObjectSchema<IPageModel> = BaseModel.concat(
    Joi.object({
        type: Joi.string().valid('page').required(),
        layout: Joi.string().when(Joi.ref('/pageLayoutKey'), { is: Joi.exist(), then: Joi.required() }),
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

export type IModel = IObjectModel | IDataModel | IPageModel;

const Model = Joi.object<IModel>({
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

export type IModels = Record<string, IModel>;

const Models = Joi.object<IModels>()
    .pattern(modelNamePattern, Model)
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
            } else if (error.code === 'any.unknown' && error.path.length === 3 && error.path[0] === 'models' && error.path[2] === 'items') {
                error.code = modelListForbiddenErrorCode;
            } else if (error.code === 'array.unique' && error.path.length > 3 && error.path[0] === 'models' && _.nth(error.path, -2) === 'fields') {
                error.code = fieldNameUnique;
            }
            return error;
        });
    }) as any) // the type definition of Joi.ValidationErrorFunction is wrong, so we override
    .prefs({
        messages: {
            [modelNamePatternMatchErrorCode]:
                'Invalid model name "{{#key}}" at "{{#label}}". A model name must contain only lower case alphanumeric characters and underscores, must start with a lower case letter, and end with alphanumeric character.',
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

export interface ISchema {
    stackbitVersion: string;
    ssgName?: typeof SSG_NAMES[number];
    ssgVersion?: string;
    cmsName?: typeof CMS_NAMES[number];
    import?: IImport;
    buildCommand?: string;
    publishDir?: string;
    staticDir?: string;
    uploadDir?: string;
    assets?: IAssetsModel;
    pagesDir?: string | null;
    dataDir?: string | null;
    pageLayoutKey?: string | null;
    objectTypeKey?: string;
    excludePages?: string | string[];
    logicFields?: ILogicField[];
    models?: IModels;
}

const schema = Joi.object<ISchema>({
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
    });

export const stackbitConfigSchema = schema;
