import Joi from 'joi';
import _ from 'lodash';
import { StricterUnion } from '../utils';

// SSGs Stackbit Stuio supports
const SSG_NAMES = ['unibit', 'jekyll', 'hugo', 'gatsby', 'nextjs', 'custom', 'eleventy', 'vuepress', 'gridsome', 'nuxt', 'sapper', 'hexo'] as const;

// CMSes Stackbit Stuio supports
const CMS_NAMES = ['git', 'contentful', 'sanity', 'forestry', 'netlifycms'] as const;

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
    'object',
    'model',
    'reference',
    'list'
] as const;

export type FieldType = typeof FIELD_TYPES[number];

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
    const models = _.last<YamlConfig>(state.ancestors)!.models ?? {};
    const modelNames = Object.keys(models);
    const objectModelNames = modelNames.filter((modelName) => models[modelName]!.type === 'object');
    if (!objectModelNames.includes(value)) {
        return error(objectModelNameErrorCode);
    }
    return value;
});

const validPageOrDataModelNames = Joi.custom((value, { error, state }) => {
    const models = _.last<YamlConfig>(state.ancestors)!.models ?? {};
    const modelNames = Object.keys(models);
    const documentModels = modelNames.filter((modelName) => ['page', 'data'].includes(models[modelName]!.type));
    if (!documentModels.includes(value)) {
        return error(documentModelNameErrorCode);
    }
    return value;
});

export type LogicField = string;

const logicField = Joi.string();
// TODO: validate that all logicFields reference existing fields
// const logicField = Joi.custom((value) => {
//     return value;
// });

const inFields = Joi.string()
    .valid(
        Joi.in('fields', {
            adjust: (fields) => (_.isArray(fields) ? fields.map((field) => field.name) : [])
        })
    )
    .prefs({
        messages: { 'any.only': '{{#label}} must be one of model field names, got "{{#value}}"' },
        errors: { wrap: { label: false } }
    });

export interface ContentfulImport {
    type: 'contentful';
    contentFile: string;
    uploadAssets?: boolean;
    assetsDirectory?: string;
    spaceIdEnvVar?: string;
    accessTokenEnvVar?: string;
}

const contentfulImportSchema = Joi.object<ContentfulImport>({
    type: Joi.string().valid('contentful').required(),
    contentFile: Joi.string().required(),
    uploadAssets: Joi.boolean(),
    assetsDirectory: Joi.string(),
    spaceIdEnvVar: Joi.string(),
    accessTokenEnvVar: Joi.string()
}).and('uploadAssets', 'assetsDirectory');

export interface SanityImport {
    type: 'sanity';
    contentFile: string;
    sanityStudioPath: string;
    deployStudio?: boolean;
    deployGraphql?: boolean;
    projectIdEnvVar?: string;
    datasetEnvVar?: string;
    tokenEnvVar?: string;
}

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

export type Import = ContentfulImport | SanityImport;

const importSchema = Joi.alternatives().conditional('.type', {
    switch: [
        { is: 'contentful', then: contentfulImportSchema },
        { is: 'sanity', then: sanityImportSchema }
    ]
});

export interface StaticAssetsModal {
    referenceType: 'static';
    assetsDir?: string;
    staticDir: string;
    publicPath: string;
    uploadDir?: string;
}

export interface RelativeAssetsModal {
    referenceType: 'relative';
    assetsDir: string;
    staticDir?: string;
    publicPath?: string;
    uploadDir?: string;
}

export interface ModelsSource {
    type: 'files';
    modelsDir: string[];
}

const modelsSourceSchema = Joi.object<ModelsSource>({
    type: 'files',
    modelsDir: Joi.array().items(Joi.string()).required()
});

export type AssetsModel = StricterUnion<StaticAssetsModal | RelativeAssetsModal>;

const assetsSchema = Joi.object<AssetsModel>({
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

export interface FieldCommonProps {
    name: string;
    label?: string;
    description?: string;
    required?: boolean;
    default?: unknown;
    const?: unknown;
    hidden?: boolean;
    readOnly?: boolean;
}

export type FieldEnumValue = string | number;

export interface FieldEnumOptionWithLabel {
    label: string;
    value: FieldEnumValue;
}

export type FieldSchemaEnumOptions = FieldEnumValue[] | FieldEnumOptionWithLabel[];

export interface FieldEnumProps {
    type: 'enum';
    options: FieldSchemaEnumOptions;
}

export interface FieldObjectProps {
    type: 'object';
    labelField?: string;
    fields: Field[];
}

export interface FieldListProps {
    type: 'list';
    items?: FieldListItems;
}

export interface FieldNumberProps {
    type: 'number';
    subtype?: 'int' | 'float';
    min?: number;
    max?: number;
    step?: number;
}

export interface FieldModelProps {
    type: 'model';
    models: string[];
}

export interface FieldReferenceProps {
    type: 'reference';
    models: string[];
}

export interface FieldSimpleNoProps {
    type: Exclude<FieldType, 'enum' | 'number' | 'object' | 'model' | 'reference' | 'list'>;
}

type NonStrictFieldPartialProps =
    | FieldEnumProps
    | FieldObjectProps
    | FieldListProps
    | FieldNumberProps
    | FieldModelProps
    | FieldReferenceProps
    | FieldSimpleNoProps;

export type FieldPartialProps = StricterUnion<NonStrictFieldPartialProps>;

export type FieldListItems = StricterUnion<Exclude<NonStrictFieldPartialProps, FieldListProps>>;

export type SimpleField = FieldSimpleNoProps & FieldCommonProps;
export type FieldEnum = FieldEnumProps & FieldCommonProps;
export type FieldObject = FieldObjectProps & FieldCommonProps;
export type FieldList = FieldListProps & FieldCommonProps;
export type FieldNumber = FieldNumberProps & FieldCommonProps;
export type FieldModel = FieldModelProps & FieldCommonProps;
export type FieldReference = FieldReferenceProps & FieldCommonProps;

export type Field = FieldPartialProps & FieldCommonProps;

const fieldCommonPropsSchema = Joi.object({
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
    readOnly: Joi.boolean()
}).oxor('const', 'default');

const numberFieldPartialSchema = Joi.object({
    type: Joi.string().valid('number').required(),
    subtype: Joi.string().valid('int', 'float'),
    min: Joi.number(),
    max: Joi.number(),
    step: Joi.number()
});

const enumFieldPartialSchema = Joi.object({
    type: Joi.string().valid('enum').required(),
    options: Joi.alternatives()
        .try(
            Joi.array().items(Joi.string(), Joi.number()),
            Joi.array().items(
                Joi.object({
                    label: Joi.string().required(),
                    value: Joi.alternatives().try(Joi.string(), Joi.number()).required()
                })
            )
        )
        .required()
        .prefs({
            messages: { 'alternatives.types': '{{#label}} must be an array of strings or numbers, or array of objects with label and value properties' },
            errors: { wrap: { label: false } }
        })
});

const objectFieldPartialSchema = Joi.object({
    type: Joi.string().valid('object').required(),
    labelField: inFields,
    fields: Joi.link('#fieldsSchema').required()
});

const modelFieldPartialSchema = Joi.object({
    type: Joi.string().valid('model').required(),
    models: Joi.array().items(validObjectModelNames).required()
});

const referenceFieldPartialSchema = Joi.object({
    type: Joi.string().valid('reference').required(),
    models: Joi.array().items(validPageOrDataModelNames).required()
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

const partialFieldWithListSchema = partialFieldSchema.when('.type', { is: 'list', then: listFieldPartialSchema });

const fieldSchema: Joi.ObjectSchema<Field> = fieldCommonPropsSchema.concat(partialFieldWithListSchema);

const fieldsSchema = Joi.array().items(fieldSchema).unique('name').id('fieldsSchema');

export interface YamlBaseModel {
    label: string;
    description?: string;
    extends?: string | string[];
    labelField?: string;
    fields?: Field[];
}

interface BaseMatch {
    folder?: string;
    match?: string | string[];
    exclude?: string | string[];
}

const baseModelSchema = Joi.object({
    type: Joi.string().valid('page', 'data', 'config', 'object').required(),
    label: Joi.string().required().when(Joi.ref('/import'), { is: Joi.exist(), then: Joi.optional() }),
    description: Joi.string(),
    extends: Joi.array().items(validObjectModelNames).single(),
    labelField: inFields,
    fields: Joi.link('#fieldsSchema')
});

export interface YamlObjectModel extends YamlBaseModel {
    type: 'object';
}

const objectModelSchema = baseModelSchema.concat(
    Joi.object({
        type: Joi.string().valid('object').required()
    })
);

export interface BaseDataModel extends YamlBaseModel {
    type: 'data';
}

export interface BaseDataModelFileSingle extends BaseDataModel {
    file: string;
    isList?: false;
}

export interface BaseDataModelFileList extends Omit<BaseDataModel, 'fields'> {
    file: string;
    isList: true;
    items: FieldListItems;
}

export interface BaseDataModelMatchSingle extends BaseDataModel, BaseMatch {
    isList?: false;
}

export interface BaseDataModelMatchList extends Omit<BaseDataModel, 'fields'>, BaseMatch {
    isList: true;
    items: FieldListItems;
}

export type YamlDataModel = StricterUnion<BaseDataModelFileSingle | BaseDataModelFileList | BaseDataModelMatchSingle | BaseDataModelMatchList>;

const dataModelSchema: Joi.ObjectSchema<YamlDataModel> = baseModelSchema
    .concat(
        Joi.object({
            type: Joi.string().valid('data').required(),
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

export interface YamlConfigModel extends YamlBaseModel {
    type: 'config';
    file?: string;
}
const configModelSchema: Joi.ObjectSchema<YamlConfigModel> = baseModelSchema.concat(
    Joi.object({
        type: Joi.string().valid('config').required(),
        file: Joi.string()
    })
);

export interface BasePageModel extends YamlBaseModel {
    type: 'page';
    layout?: string;
    urlPath?: string;
    filePath?: string;
    hideContent?: boolean;
}

export interface PageModelSingle extends BasePageModel {
    singleInstance: true;
    file: string;
}

export interface PageModelMatch extends BasePageModel, BaseMatch {
    singleInstance?: false;
}

export type YamlPageModel = StricterUnion<PageModelSingle | PageModelMatch>;

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

export type YamlModel = StricterUnion<YamlObjectModel | YamlDataModel | YamlConfigModel | YamlPageModel>;

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

export type YamlModels = Record<string, YamlModel>;

const modelsSchema = Joi.object<YamlModels>()
    .pattern(modelNamePattern, modelSchema)
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
            [modelNamePatternMatchErrorCode]:
                'Invalid model name "{{#key}}" at "{{#label}}". A model name must contain only alphanumeric characters and underscores, must start with a letter, and end with alphanumeric character.',
            [modelFileExclusiveErrorCode]: '{{#label}} cannot be used with "file"',
            [modelIsListItemsRequiredErrorCode]: '{{#label}} is required when "isList" is true',
            [modelIsListFieldsForbiddenErrorCode]: '{{#label}} is not allowed when "isList" is true',
            [modelListForbiddenErrorCode]: '{{#label}} is not allowed when "isList" is not true',
            [objectModelNameErrorCode]: '{{#label}} must reference the name of an existing model of type "object", got "{{#value}}"',
            [documentModelNameErrorCode]: '{{#label}} must reference the name of an existing model of type "page" or "data", got "{{#value}}"',
            [fieldNameUnique]: '{{#label}} contains a duplicate field name "{{#value.name}}"'
        },
        errors: { wrap: { label: false } }
    });

export interface YamlConfig {
    stackbitVersion: string;
    ssgName?: typeof SSG_NAMES[number];
    ssgVersion?: string;
    nodeVersion?: string;
    devCommand?: string;
    cmsName?: typeof CMS_NAMES[number];
    import?: Import;
    buildCommand?: string;
    publishDir?: string;
    staticDir?: string;
    uploadDir?: string;
    assets?: AssetsModel;
    pagesDir?: string | null;
    dataDir?: string | null;
    pageLayoutKey?: string | null;
    objectTypeKey?: string;
    excludePages?: string | string[];
    logicFields?: LogicField[];
    modelsSource?: ModelsSource;
    models?: YamlModels;
}

const schema = Joi.object<YamlConfig>({
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
    excludePages: Joi.array().items(Joi.string()).single(),
    logicFields: Joi.array().items(logicField),
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

export const stackbitConfigSchema = schema;
