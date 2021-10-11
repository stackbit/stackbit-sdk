import Joi from 'joi';
import _ from 'lodash';
import { append } from '@stackbit/utils';

import { STYLE_PROPS_VALUES } from '../config/config-consts';
import { isDataModel, isPageModel } from '../utils';
import {
    Config,
    Field,
    FieldEnumOptionObject,
    FieldEnumOptionPalette,
    FieldEnumOptionThumbnails,
    FieldEnumOptionValue,
    FieldEnumProps,
    FieldListItems,
    FieldListProps,
    FieldModelProps,
    FieldNumberProps,
    FieldObjectProps,
    FieldReferenceProps,
    FieldStyleProps,
    Model,
    StyleProps
} from '../config/config-types';

type FieldPath = (string | number)[];

type ModelSchemaMap = Record<string, Joi.ObjectSchema>;

const metadataSchema = Joi.object({
    modelName: Joi.string().allow(null),
    filePath: Joi.string(),
    error: Joi.string()
});

export function joiSchemasForModels(config: Config) {
    const modelSchemas = _.reduce(
        config.models,
        (modelSchemas: ModelSchemaMap, model: Model) => {
            let joiSchema: Joi.ObjectSchema;
            if (model.__metadata?.invalid) {
                // if root model is invalid, replace the label with "file" otherwise joi outputs "value" which is not descriptive
                let objectLabel = '{{#label}}';
                if (isDataModel(model) || isPageModel(model)) {
                    objectLabel = 'file';
                }
                joiSchema = Joi.object()
                    .forbidden()
                    .messages({
                        'any.unknown': `${objectLabel} cannot be validated, the model "${model.name}" is invalid. Fix the model to validate the content.`
                    });
            } else {
                joiSchema = joiSchemaForModel(model, config);
            }
            modelSchemas[model.name] = joiSchema.id(`${model.name}_model_schema`);
            return modelSchemas;
        },
        {}
    );

    // Allow linking between recursive schemas by calling shared() on every schema with every other schema
    // https://joi.dev/api/?v=17.4.0#anysharedschema
    // Example: given three schemas: pageSchema, sectionSchema, authorSchema
    //   pageSchema.shared(sectionSchema).shared(authorSchema)
    //   sectionSchema.shared(pageSchema).shared(authorSchema)
    //   authorSchema.shared(pageSchema).shared(sectionSchema)
    // Future optimization - no need to link between all schemas, but only these that have internal links
    return _.reduce(
        modelSchemas,
        (accum: ModelSchemaMap, modelSchema: Joi.ObjectSchema, modelName: string) => {
            const otherModelSchemas = _.omit(modelSchemas, modelName);
            accum[modelName] = _.reduce(
                otherModelSchemas,
                (modelSchema: Joi.ObjectSchema, otherModelSchema: Joi.ObjectSchema) => {
                    return modelSchema.shared(otherModelSchema);
                },
                modelSchema
            );
            return accum;
        },
        {}
    );
}

export function joiSchemaForModel(model: Model, config: Config) {
    if (isDataModel(model) && model.isList) {
        return Joi.object({
            items: Joi.array().items(joiSchemaForField(model.items, config, [model.name, 'items']))
        });
    } else {
        return joiSchemaForModelFields(model.fields, config, [model.name]);
    }
}

function joiSchemaForModelFields(fields: Field[] | undefined, config: Config, fieldPath: FieldPath) {
    return Joi.object(
        _.reduce(
            fields,
            (schema: Record<string, Joi.Schema>, field) => {
                const childFieldPath = fieldPath.concat(`[name='${field.name}']`);
                schema[field.name] = joiSchemaForField(field, config, childFieldPath);
                return schema;
            },
            {}
        )
    );
}

function joiSchemaForField(field: Field | FieldListItems, config: Config, fieldPath: FieldPath) {
    let fieldSchema;
    switch (field.type) {
        case 'string':
        case 'url':
        case 'slug':
        case 'text':
        case 'markdown':
        case 'html':
        case 'image':
        case 'file':
        case 'color':
            fieldSchema = Joi.string().allow('', null);
            break;
        case 'boolean':
            fieldSchema = Joi.boolean();
            break;
        case 'date':
        case 'datetime':
            fieldSchema = Joi.date();
            break;
        case 'enum':
            fieldSchema = enumFieldValueSchema(field);
            break;
        case 'number':
            fieldSchema = numberFieldValueSchema(field);
            break;
        case 'object':
            fieldSchema = objectFieldValueSchema(field, config, fieldPath);
            break;
        case 'model':
            fieldSchema = modelFieldValueSchema(field, config);
            break;
        case 'reference':
            fieldSchema = referenceFieldValueSchema(field);
            break;
        case 'style':
            fieldSchema = styleFieldValueSchema(field);
            break;
        case 'list':
            fieldSchema = listFieldValueSchema(field, config, fieldPath);
            break;
    }
    if ('const' in field) {
        fieldSchema = fieldSchema.valid(field.const).invalid(null, '').required();
    } else if ('required' in field && field.required === true) {
        fieldSchema = fieldSchema.required();
    }
    return fieldSchema;
}

function enumFieldValueSchema(field: FieldEnumProps): Joi.Schema {
    if (field.options) {
        const values = field.options.map((option: FieldEnumOptionValue | FieldEnumOptionObject | FieldEnumOptionThumbnails | FieldEnumOptionPalette) => {
            return typeof option === 'object' ? option.value : option;
        });
        return Joi.valid(...values);
    }
    return Joi.any().forbidden();
}

function numberFieldValueSchema(field: FieldNumberProps): Joi.Schema {
    let result = Joi.number();
    if (field.subtype !== 'float') {
        result = result.integer();
    }
    if (field.min) {
        result = result.min(field.min);
    }
    if (field.max) {
        result = result.max(field.max);
    }
    if (field.step) {
        result = result.multiple((field.min || 0) + field.step);
    }
    return result;
}

function objectFieldValueSchema(field: FieldObjectProps, config: Config, fieldPath: FieldPath): Joi.Schema {
    const childFieldPath = fieldPath.concat('fields');
    return joiSchemaForModelFields(field.fields, config, childFieldPath);
}

function modelFieldValueSchema(field: FieldModelProps, config: Config): Joi.Schema {
    if (field.models.length === 0) {
        return Joi.any().forbidden();
    }
    const objectTypeKey = config.objectTypeKey || 'type';
    const typeSchema = Joi.string().valid(...field.models);
    if (field.models.length === 1 && field.models[0]) {
        const modelName = field.models[0];
        return Joi.link()
            .ref(`#${modelName}_model_schema`)
            .concat(
                Joi.object({
                    __metadata: metadataSchema,
                    [objectTypeKey]: typeSchema
                })
            );
    } else {
        // if there is more than one model in models, then 'type' field is
        // required to identify the object
        return Joi.alternatives()
            .conditional(`.${objectTypeKey}`, {
                switch: _.map(field.models, (modelName) => {
                    return {
                        is: modelName,
                        then: Joi.link()
                            .ref(`#${modelName}_model_schema`)
                            .concat(
                                Joi.object({
                                    __metadata: metadataSchema,
                                    [objectTypeKey]: Joi.string()
                                })
                            )
                    };
                })
            })
            .prefs({
                messages: {
                    'alternatives.any': `{{#label}}.${objectTypeKey} is required and must be one of [${field.models.join(', ')}].`
                },
                errors: { wrap: { label: false } }
            });
    }
}

function referenceFieldValueSchema(field: FieldReferenceProps): Joi.Schema {
    // TODO: validate reference by looking if referenced filePath actually exists
    //  and the stored object has the correct type
    return Joi.string();
}

function listFieldValueSchema(field: FieldListProps, config: Config, fieldPath: FieldPath): Joi.Schema {
    if (field.items) {
        const childFieldPath = fieldPath.concat('items');
        const itemsSchema = joiSchemaForField(field.items, config, childFieldPath);
        return Joi.array().items(itemsSchema);
    }
    return Joi.array().items(Joi.string());
}

function styleFieldValueSchema(field: FieldStyleProps): Joi.Schema {
    const styleFieldSchema = _.mapValues(field.styles, (fieldStyles) => {
        const styleProps = _.keys(fieldStyles) as StyleProps[];
        const objectSchema = _.reduce(
            styleProps,
            (schema: Partial<Record<StyleProps, Joi.Schema>>, styleProp) => {
                const createSchema = StylePropContentSchemas[styleProp];
                if (!createSchema) {
                    return schema;
                }
                const styleConfig = fieldStyles[styleProp];
                const valueSchema = createSchema(styleConfig);
                if (!valueSchema) {
                    return schema;
                }
                schema[styleProp] = valueSchema;
                return schema;
            },
            {}
        );
        return Joi.object(objectSchema);
    });
    return Joi.object(styleFieldSchema);
}

const StylePropContentSchemas: Record<StyleProps, (styleConfig: any) => Joi.Schema | null> = {
    objectFit: stylePropSchemaWithValidValues(STYLE_PROPS_VALUES.objectFit),
    objectPosition: stylePropSchemaWithValidValues(STYLE_PROPS_VALUES.nineRegions),
    flexDirection: stylePropSchemaWithValidValues(STYLE_PROPS_VALUES.flexDirection),
    justifyItems: stylePropSchemaWithValidValues(STYLE_PROPS_VALUES.justifyItems),
    justifySelf: stylePropSchemaWithValidValues(STYLE_PROPS_VALUES.justifySelf),
    alignItems: stylePropSchemaWithValidValues(STYLE_PROPS_VALUES.alignItems),
    alignSelf: stylePropSchemaWithValidValues(STYLE_PROPS_VALUES.alignSelf),
    padding: stylePropSizeSchema,
    margin: stylePropSizeSchema,
    width: stylePropSchemaWithValidValues(STYLE_PROPS_VALUES.width),
    height: stylePropSchemaWithValidValues(STYLE_PROPS_VALUES.height),
    fontFamily: stylePropObjectValueSchema,
    fontSize: stylePropSchemaWithValidValues(STYLE_PROPS_VALUES.fontSize),
    fontStyle: stylePropSchemaWithValidValues(STYLE_PROPS_VALUES.fontStyle),
    fontWeight: stylePropFontWeightSchema,
    textAlign: stylePropSchemaWithValidValues(STYLE_PROPS_VALUES.textAlign),
    textColor: stylePropObjectValueSchema,
    textDecoration: stylePropSchemaWithValidValues(STYLE_PROPS_VALUES.textDecoration),
    backgroundColor: stylePropObjectValueSchema,
    backgroundPosition: stylePropSchemaWithValidValues(STYLE_PROPS_VALUES.nineRegions),
    backgroundSize: stylePropSchemaWithValidValues(STYLE_PROPS_VALUES.backgroundSize),
    borderRadius: stylePropSchemaWithValidValues(STYLE_PROPS_VALUES.borderRadius),
    borderWidth: stylePropSizeSchema,
    borderColor: stylePropObjectValueSchema,
    borderStyle: stylePropSchemaWithValidValues(STYLE_PROPS_VALUES.borderStyle),
    boxShadow: stylePropSchemaWithValidValues(STYLE_PROPS_VALUES.boxShadow),
    opacity: stylePropOpacitySchema
};

function stylePropSchemaWithValidValues(validValues: any[]) {
    return (styleConfig: any) => {
        if (styleConfig === '*') {
            return Joi.string().valid(...validValues);
        }
        if (Array.isArray(styleConfig)) {
            return Joi.string().valid(...styleConfig);
        }
        return null;
    };
}

function stylePropSizeSchema(styleConfig: any) {
    if (styleConfig === '*') {
        return Joi.object({
            top: Joi.number(),
            bottom: Joi.number(),
            left: Joi.number(),
            right: Joi.number()
        });
    }
    // TODO: validate Tailwind paddings
    styleConfig = _.castArray(styleConfig);
    const dirSchemas = _.reduce(
        styleConfig,
        (dirSchemas: any, pattern: any) => {
            if (typeof pattern !== 'string') {
                return dirSchemas;
            }
            const directionMatch = pattern.match(/^[xylrtb]/);
            const directions = [];
            if (!directionMatch) {
                directions.push('top', 'bottom', 'left', 'right');
            } else {
                const dirMap = {
                    x: ['left', 'right'],
                    y: ['top', 'bottom'],
                    l: ['left'],
                    r: ['right'],
                    t: ['top'],
                    b: ['bottom']
                };
                const dirMatch = directionMatch[0] as 'x' | 'y' | 'l' | 'r' | 't' | 'b';
                directions.push(...dirMap[dirMatch]);
                pattern = pattern.substring(1);
            }
            let valueSchema = Joi.number();
            if (pattern) {
                const parts = pattern.split(':').map((value: string) => Number(value));
                if (_.some(parts, _.isNaN)) {
                    return dirSchemas;
                }
                if (parts.length === 1) {
                    valueSchema = valueSchema.valid(parts[0]);
                } else {
                    valueSchema = valueSchema.min(parts[0]).max(parts[1]);
                    if (parts.length === 3) {
                        valueSchema = valueSchema.multiple(parts[3]);
                    }
                }
            }
            _.forEach(directions, (direction) => {
                append(dirSchemas, direction, valueSchema);
            });
            return dirSchemas;
        },
        {}
    );
    const objectSchema = _.mapValues(dirSchemas, (schema) => Joi.alternatives(...schema));
    return Joi.object(objectSchema);
}

function stylePropObjectValueSchema(styleConfig: any) {
    return Joi.valid(..._.map(styleConfig, (object) => _.get(object, 'value')));
}

function stylePropFontWeightSchema(styleConfig: any) {
    if (styleConfig === '*') {
        return Joi.string().valid(...STYLE_PROPS_VALUES.fontWeight);
    }
    styleConfig = _.castArray(styleConfig);
    const validValues = _.reduce(
        styleConfig,
        (validValues, value) => {
            if (_.isNumber(value)) {
                return validValues.add(String(value));
            }
            if (!_.isString(value)) {
                return validValues;
            }
            if (_.isEmpty(value)) {
                return validValues;
            }
            const parts = value.split(':').map((value) => Number(value));
            if (_.some(parts, _.isNaN)) {
                return validValues;
            }
            if (parts.length === 1) {
                return validValues.add(String(parts[0]!));
            }
            const start = parts[0]!;
            const end = parts[1]!;
            for (let i = start; i <= end; i += 100) {
                validValues.add(String(i));
            }
            return validValues;
        },
        new Set<string>()
    );
    return Joi.valid(...[...validValues]);
}

function stylePropOpacitySchema(styleConfig: any) {
    if (styleConfig === '*') {
        return Joi.number().integer().min(0).max(100).multiple(5);
    }
    styleConfig = _.castArray(styleConfig);
    const validValues = _.reduce(
        styleConfig,
        (validValues, value) => {
            if (_.isNumber(value)) {
                return validValues.add(value);
            }
            if (!_.isString(value)) {
                return validValues;
            }
            if (_.isEmpty(value)) {
                return validValues;
            }
            const parts = value.split(':').map((value) => Number(value));
            if (_.some(parts, _.isNaN)) {
                return validValues;
            }
            if (parts.length === 1) {
                return validValues.add(parts[0]!);
            }
            const start = parts[0]!;
            const end = parts[1]!;
            for (let i = start; i <= end; i += 5) {
                validValues.add(i);
            }
            return validValues;
        },
        new Set<number>()
    );
    return Joi.valid(...[...validValues]);
}
