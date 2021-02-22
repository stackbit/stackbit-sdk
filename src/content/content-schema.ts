import Joi from 'joi';
import _ from 'lodash';

import { IModel } from '../config/config-loader';
import { IllegalModelField, ModelNotFound } from './content-errors';
import {
    FieldType,
    IField,
    IFieldEnumProps,
    IFieldSchemaEnumValue,
    IFieldPartialModelOrReference,
    IFieldNumberProps,
    IFieldObjectProps,
    IFieldListProps,
    IListItems
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

function joiSchemaForField(field: IField | IListItems, fieldPath: FieldPath, models: IModel[]) {
    const fieldSchemaGenerator = FieldSchemas[field.type];
    let fieldSchema = fieldSchemaGenerator(field, fieldPath, models);
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

const StringWithEmptyAndNull = Joi.string().allow('', null);

// TODO: is there a way not to pass field: any?
const FieldSchemas: Record<FieldType, (field: any, fieldPath: FieldPath, models: IModel[]) => Joi.Schema> = {
    string: () => StringWithEmptyAndNull,
    url: () => StringWithEmptyAndNull,
    slug: () => StringWithEmptyAndNull,
    text: () => StringWithEmptyAndNull,
    markdown: () => StringWithEmptyAndNull,
    html: () => StringWithEmptyAndNull,
    image: () => StringWithEmptyAndNull,
    file: () => StringWithEmptyAndNull,
    color: () => StringWithEmptyAndNull,
    boolean: () => Joi.boolean(),
    date: () => Joi.date(),
    datetime: () => Joi.date(),
    enum: (field: IFieldEnumProps) => {
        if (field.options) {
            // TODO: how to deal with this?
            // @ts-ignore
            const values = field.options.map((option): IFieldSchemaEnumValue => (_.isPlainObject(option) ? option.value : option));
            return Joi.valid(...values);
        }
        return Joi.any().forbidden();
    },
    number: (field: IFieldNumberProps) => {
        let result = Joi.number();
        if (field.subtype !== 'float') {
            result = result.integer();
        }
        // if (field.min) {
        //     result = result.min(field.min);
        // }
        // if (field.max) {
        //     result = result.max(field.max);
        // }
        // if (field.step) {
        //
        // }
        return result;
    },
    object: (field: IFieldObjectProps, fieldPath: FieldPath, models: IModel[]) => {
        const childFieldPath = fieldPath.concat('fields');
        return joiSchemaForModelFields(field.fields, childFieldPath, models);
    },
    model: (field: IFieldPartialModelOrReference, fieldPath: FieldPath, models: IModel[]) => {
        if (field.models.length === 0) {
            return Joi.any().forbidden();
        }
        let typeSchema = Joi.string().valid(...field.models);
        if (field.models.length === 1) {
            const modelName = field.models[0]!;
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
    list: (field: IFieldListProps, fieldPath: FieldPath, models: IModel[]) => {
        if (field.items) {
            const childFieldPath = fieldPath.concat('items');
            const itemsSchema = joiSchemaForField(field.items, childFieldPath, models);
            return Joi.array().items(itemsSchema);
        }
        return Joi.array().items(Joi.string());
    }
};
