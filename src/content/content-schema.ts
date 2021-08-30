import Joi from 'joi';
import _ from 'lodash';

import { Model } from '../config/config-loader';
import {
    Field,
    FieldNumberProps,
    FieldEnumProps,
    FieldEnumValue,
    FieldEnumOptionWithLabel,
    FieldObjectProps,
    FieldModelProps,
    FieldReferenceProps,
    FieldListProps,
    FieldListItems
} from '..';
import { isDataModel, isPageModel } from '../utils';

type FieldPath = (string | number)[];

type ModelSchemaMap = Record<string, Joi.ObjectSchema>;

const metadataSchema = Joi.object({
    modelName: Joi.string().allow(null),
    filePath: Joi.string(),
    error: Joi.string()
});

export function joiSchemasForModels(models: Model[]) {
    const modelSchemas = _.reduce(
        models,
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
                joiSchema = joiSchemaForModel(model);
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

export function joiSchemaForModel(model: Model) {
    if (isDataModel(model) && model.isList) {
        return Joi.object({
            items: Joi.array().items(joiSchemaForField(model.items, [model.name, 'items']))
        });
    } else {
        return joiSchemaForModelFields(model.fields, [model.name]);
    }
}

function joiSchemaForModelFields(fields: Field[] | undefined, fieldPath: FieldPath) {
    return Joi.object(
        _.reduce(
            fields,
            (schema: Record<string, Joi.Schema>, field) => {
                const childFieldPath = fieldPath.concat(`[name='${field.name}']`);
                schema[field.name] = joiSchemaForField(field, childFieldPath);
                return schema;
            },
            {}
        )
    );
}

function joiSchemaForField(field: Field | FieldListItems, fieldPath: FieldPath) {
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
            fieldSchema = FieldSchemas.enum(field, fieldPath);
            break;
        case 'number':
            fieldSchema = FieldSchemas.number(field, fieldPath);
            break;
        case 'object':
            fieldSchema = FieldSchemas.object(field, fieldPath);
            break;
        case 'model':
            fieldSchema = FieldSchemas.model(field, fieldPath);
            break;
        case 'reference':
            fieldSchema = Joi.string();
            break;
        case 'list':
            fieldSchema = FieldSchemas.list(field, fieldPath);
            break;
    }
    if ('const' in field) {
        fieldSchema = fieldSchema.valid(field.const).invalid(null, '').required();
    } else if ('required' in field && field.required === true) {
        fieldSchema = fieldSchema.required();
    }
    return fieldSchema;
}

export type FieldPropsByType = {
    enum: FieldEnumProps;
    number: FieldNumberProps;
    object: FieldObjectProps;
    model: FieldModelProps;
    reference: FieldReferenceProps;
    list: FieldListProps;
};

const FieldSchemas: { [fieldType in keyof FieldPropsByType]: (field: FieldPropsByType[fieldType], fieldPath: FieldPath) => Joi.Schema } = {
    enum: (field) => {
        if (field.options) {
            const values = (field.options as (FieldEnumValue | FieldEnumOptionWithLabel)[]).map((option) =>
                typeof option === 'number' || typeof option === 'string' ? option : option.value
            );
            return Joi.valid(...values);
        }
        return Joi.any().forbidden();
    },
    number: (field) => {
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
        return result;
    },
    object: (field, fieldPath: FieldPath) => {
        const childFieldPath = fieldPath.concat('fields');
        return joiSchemaForModelFields(field.fields, childFieldPath);
    },
    model: (field) => {
        if (field.models.length === 0) {
            return Joi.any().forbidden();
        }
        const typeSchema = Joi.string().valid(...field.models);
        if (field.models.length === 1 && field.models[0]) {
            const modelName = field.models[0];
            return Joi.link()
                .ref(`#${modelName}_model_schema`)
                .concat(
                    Joi.object({
                        __metadata: metadataSchema,
                        // TODO: change to objectTypeKey
                        type: typeSchema
                    })
                );
        } else {
            // if there is more than one model in models, then 'type' field is
            // required to identify the object
            return Joi.alternatives()
                .conditional('.type', {
                    switch: _.map(field.models, (modelName) => {
                        return {
                            is: modelName,
                            then: Joi.link()
                                .ref(`#${modelName}_model_schema`)
                                .concat(
                                    Joi.object({
                                        __metadata: metadataSchema,
                                        // TODO: change to objectTypeKey
                                        type: Joi.string()
                                    })
                                )
                        };
                    })
                })
                .prefs({
                    messages: {
                        'alternatives.any': `"{{#label}}.type" is required and must be one of [${field.models.join(', ')}].`
                    },
                    errors: { wrap: { label: false } }
                });
        }
    },
    // TODO: validate reference by looking if referenced filePath actually exists
    reference: () => Joi.string(),
    list: (field, fieldPath: FieldPath) => {
        if (field.items) {
            const childFieldPath = fieldPath.concat('items');
            const itemsSchema = joiSchemaForField(field.items, childFieldPath);
            return Joi.array().items(itemsSchema);
        }
        return Joi.array().items(Joi.string());
    }
};
