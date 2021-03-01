import Joi from 'joi';
import _ from 'lodash';

import { IModel } from '../config/config-loader';
import { IllegalModelField, ModelNotFound } from './content-errors';
import {
    IField,
    IFieldSimpleNoProps,
    IFieldNumberProps,
    IFieldEnumProps,
    IFieldEnumValue,
    IFieldEnumOptionWithLabel,
    IFieldObjectProps,
    IFieldModelProps,
    IFieldReferenceProps,
    IFieldListProps,
    IFieldListItems
} from '..';
import { isDataModel, isObjectModel } from '../schema-utils';

type FieldPath = (string | number)[];

export function joiSchemaForModelName(modelName: string, models: IModel[]) {
    const model = getModelByName(modelName, models);
    if (!model) {
        throw new Error(`model ${modelName} not found`);
    }
    return joiSchemaForModel(model, models);
}

export function joiSchemaForModel(model: IModel, models: IModel[]) {
    if (isDataModel(model) && model.isList) {
        return Joi.object({
            items: Joi.array().items(joiSchemaForField(model.items, [model.name, 'items'], models))
        });
    } else {
        return joiSchemaForModelFields(model.fields, [model.name], models).id(model.name);
    }
}

function joiSchemaForModelFields(fields: IField[] | undefined, fieldPath: FieldPath, models: IModel[]) {
    return Joi.object(
        _.reduce(
            fields,
            (schema: Record<string, Joi.Schema>, field) => {
                const childFieldPath = fieldPath.concat(`[name='${field.name}']`);
                schema[field.name] = joiSchemaForField(field, childFieldPath, models);
                return schema;
            },
            {}
        )
    );
}

function joiSchemaForField(field: IField | IFieldListItems, fieldPath: FieldPath, models: IModel[]) {
    let fieldSchema;
    switch (field.type) {
        case "string":
        case "url":
        case "slug":
        case "text":
        case "markdown":
        case "html":
        case "image":
        case "file":
        case "color":
            fieldSchema = Joi.string().allow('', null);
            break;
        case "boolean":
            fieldSchema = Joi.boolean();
            break;
        case "date":
        case "datetime":
            fieldSchema = Joi.date();
            break;
        case "enum":
            fieldSchema = FieldSchemas.enum(field, fieldPath, models);
            break;
        case "number":
            fieldSchema = FieldSchemas.number(field, fieldPath, models);
            break;
        case "object":
            fieldSchema = FieldSchemas.object(field, fieldPath, models);
            break;
        case "model":
            fieldSchema = FieldSchemas.model(field, fieldPath, models);
            break;
        case "reference":
            fieldSchema = Joi.string();
            break;
        case "list":
            fieldSchema = FieldSchemas.list(field, fieldPath, models);
            break;

    }
    if ('const' in field) {
        fieldSchema = fieldSchema.valid(field.const).invalid(null, '').required();
    } else if ('required' in field && field.required === true) {
        fieldSchema = fieldSchema.required();
    }
    return fieldSchema;
}

function getModelByName(modelName: string, models: IModel[]): IModel | undefined {
    return models.find((model) => model.name === modelName);
}

function joiSchemaForObjectModelForModelName(modelName: string, fieldPath: FieldPath, models: IModel[]) {
    const model = getModelByName(modelName, models);
    // errors below should never happen if schema was validated
    // - schema validation always checks that all models listed in field.models exist
    // - schema validation always checks that all models listed in field.models
    //   for field.type === model are models of type 'object'
    if (!model) {
        throw new ModelNotFound({ modelName, fieldPath });
    }
    if (!isObjectModel(model)) {
        throw new IllegalModelField({ modelName, modelType: model.type, fieldPath });
    }
    const childFieldPath = fieldPath.concat('fields');
    return joiSchemaForModelFields(model.fields, childFieldPath, models);
}

export type IFieldPropsByType = {
    boolean: IFieldSimpleNoProps;
    date: IFieldSimpleNoProps;
    datetime: IFieldSimpleNoProps;
    enum: IFieldEnumProps;
    number: IFieldNumberProps;
    object: IFieldObjectProps;
    model: IFieldModelProps;
    reference: IFieldReferenceProps;
    list: IFieldListProps;
};

const FieldSchemas: { [fieldType in keyof IFieldPropsByType]: (field: IFieldPropsByType[fieldType], fieldPath: FieldPath, models: IModel[]) => Joi.Schema } = {
    boolean: () => Joi.boolean(),
    date: () => Joi.date(),
    datetime: () => Joi.date(),
    enum: (field) => {
        if (field.options) {
            const values = (field.options as (IFieldEnumValue | IFieldEnumOptionWithLabel)[]).map((option) =>
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
    object: (field, fieldPath: FieldPath, models: IModel[]) => {
        const childFieldPath = fieldPath.concat('fields');
        return joiSchemaForModelFields(field.fields, childFieldPath, models);
    },
    model: (field, fieldPath: FieldPath, models: IModel[]) => {
        if (field.models.length === 0) {
            return Joi.any().forbidden();
        }
        const typeSchema = Joi.string().valid(...field.models);
        if (field.models.length === 1 && field.models[0]) {
            const modelName = field.models[0];
            return Joi.object({
                type: typeSchema
            }).concat(joiSchemaForObjectModelForModelName(modelName, fieldPath, models));
        } else {
            // if there is more than one model in models, then 'type' field is
            // required to identify the object
            return Joi.object({
                type: typeSchema.required()
            }).when('.type', {
                switch: _.map(field.models, (modelName) => {
                    return {
                        is: modelName,
                        then: joiSchemaForObjectModelForModelName(modelName, fieldPath, models)
                    };
                }),
                // if 'type' was invalid, no need to show 'forbidden' error
                // messages for every field in the un-identified object.
                otherwise: Joi.object().unknown()
            });
        }
    },
    reference: () => Joi.string(),
    list: (field, fieldPath: FieldPath, models: IModel[]) => {
        if (field.items) {
            const childFieldPath = fieldPath.concat('items');
            const itemsSchema = joiSchemaForField(field.items, childFieldPath, models);
            return Joi.array().items(itemsSchema);
        }
        return Joi.array().items(Joi.string());
    }
};
