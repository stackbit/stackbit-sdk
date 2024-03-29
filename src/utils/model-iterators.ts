import _ from 'lodash';

import { getListFieldItems, isListDataModel, isListField, isObjectListItems, isModelField, isObjectField, isModelListItems } from './model-utils';
import { DataModel, Field, FieldList, FieldListItems, FieldModelProps, FieldObjectProps, Model } from '../config/config-types';

/**
 * This function invokes the `iteratee` function for every field of the `model`.
 * It recursively traverses through fields of type `object` and `list` with
 * items of type `object` and invokes the `iteratee` on their child fields,
 * and so on. The traversal is a depth-first and the `iteratee` is invoked
 * before traversing the field's child fields.
 *
 * The iteratee is invoked with two parameters, `field` and `fieldPath`. The
 * `field` is the currently iterated field, and `fieldPath` is an array of
 * strings indicating the path of the `field` relative to the model.
 *
 * @example
 * model = {
 *   fields: [
 *     { name: "title", type: "string" },
 *     { name: "tags", type: "list" },
 *     { name: "banner", type: "object", fields: [{ name: "logo", type: "image" }] }
 *     {
 *       name: "actions",
 *       type: "list",
 *       items: { type: "object", fields: [{ name: "label", type: "string" }] }
 *     }
 *   ]
 * }
 * iterateModelFieldsRecursively(model, iteratee);
 * // will call the iteratee 6 times with the following "field" and "fieldPath" arguments
 *   field = { name: "title", ... }, fieldPath = ['fields', 'title']
 *   field = { name: "tags", ... }, fieldPath = ['fields', 'tags']
 *   field = { name: "banner", ... }, fieldPath = ['fields', 'banner']
 *   field = { name: "logo", ... }, fieldPath = ['fields', 'banner', 'fields', 'logo']
 *   field = { name: "actions", ... }, fieldPath = ['fields', 'actions']
 *   field = { name: "label", ... }, fieldPath = ['fields', 'actions', 'items', 'fields', 'label']
 *
 * @param model The model to iterate fields
 * @param iteratee The callback function
 */
export function iterateModelFieldsRecursively(model: Model, iteratee: (field: Field, modelKeyPath: string[]) => void) {
    function _iterateDeep({ fields, modelKeyPath }: { fields: Field[]; modelKeyPath: string[] }) {
        modelKeyPath = modelKeyPath.concat('fields');
        _.forEach(fields, (field) => {
            if (!field) {
                return;
            }
            const childModelKeyPath = modelKeyPath.concat(field.name);
            iteratee(field, childModelKeyPath);
            if (isObjectField(field)) {
                _iterateDeep({
                    fields: field.fields,
                    modelKeyPath: childModelKeyPath
                });
            } else if (isListField(field) && field.items && isObjectListItems(field.items)) {
                _iterateDeep({
                    fields: field.items?.fields,
                    modelKeyPath: childModelKeyPath.concat('items')
                });
            }
        });
    }

    if (model && isListDataModel(model) && model.items && isObjectListItems(model.items)) {
        _iterateDeep({
            fields: model.items?.fields,
            modelKeyPath: ['items']
        });
    } else {
        _iterateDeep({
            fields: model?.fields || [],
            modelKeyPath: []
        });
    }
}

export function mapModelFieldsRecursively(model: Model, iteratee: (field: Field, modelKeyPath: string[]) => Field) {
    function _mapField(field: Field, modelKeyPath: string[]): Field {
        if (!field) {
            return field;
        }
        modelKeyPath = modelKeyPath.concat(field.name);
        field = iteratee(field, modelKeyPath);
        if (isObjectField(field)) {
            return _mapObjectField(field, modelKeyPath);
        } else if (isListField(field)) {
            return _mapListField(field, modelKeyPath);
        } else {
            return field;
        }
    }

    function _mapObjectField<T extends FieldObjectProps | Model>(field: T, modelKeyPath: string[]): T {
        const fields = field.fields;
        if (!fields) {
            return field;
        }
        modelKeyPath = modelKeyPath.concat('fields');
        return {
            ...field,
            fields: _.map(fields, (field) => _mapField(field, modelKeyPath))
        };
    }

    function _mapListField<T extends FieldList | (DataModel & { isList: true })>(field: T, modelKeyPath: string[]): T {
        const items = field.items;
        if (!items || !isObjectListItems(items)) {
            return field;
        }
        return {
            ...field,
            items: _mapObjectField(items, modelKeyPath.concat('items'))
        };
    }

    if (!model) {
        return model;
    } else if (isListDataModel(model)) {
        return _mapListField(model, []);
    } else {
        return _mapObjectField(model, []);
    }
}

export function iterateObjectFieldsWithModelRecursively(
    value: any,
    model: Model,
    modelsByName: Record<string, Model>,
    iteratee: (options: {
        value: any;
        model: Model | null;
        field: Field | null;
        fieldListItem: FieldListItems | null;
        error: string | null;
        valueKeyPath: (string | number)[];
        modelKeyPath: string[];
        objectStack: any[];
    }) => void,
    { pageLayoutKey = 'layout', objectTypeKey = 'type', valueId }: { pageLayoutKey?: string; objectTypeKey?: string; valueId?: string } = {}
) {
    function _iterateDeep({
        value,
        model,
        field,
        fieldListItem,
        valueKeyPath,
        modelKeyPath,
        objectStack
    }: {
        value: any;
        model: Model | null;
        field: Field | null;
        fieldListItem: FieldListItems | null;
        valueKeyPath: (string | number)[];
        modelKeyPath: string[];
        objectStack: any[];
    }) {
        let error: string | null = null;
        let modelField: FieldModelProps | null = null;

        if (!model && !field && !fieldListItem) {
            error = `could not match model/field ${modelKeyPath.join('.')} for content at ${valueKeyPath.join('.')}`;
        }

        if (field && isModelField(field)) {
            modelField = field;
        } else if (fieldListItem && isModelListItems(fieldListItem)) {
            modelField = fieldListItem;
        }

        if (modelField) {
            const modelResult = getModelOfObject({
                object: value,
                field: modelField,
                modelsByName,
                pageLayoutKey,
                objectTypeKey,
                valueKeyPath,
                modelKeyPath
            });
            if ('error' in modelResult) {
                error = modelResult.error;
            } else {
                model = modelResult.model;
            }
            field = null;
            fieldListItem = null;
            modelKeyPath = model ? [model.name] : [];
        }

        iteratee({ value, model, field, fieldListItem, error, valueKeyPath, modelKeyPath, objectStack });

        if (_.isPlainObject(value)) {
            // if fields will not be resolved or the object will have a key that
            // doesn't exist among fields, the nested calls to _iterateDeep will
            // include an error.
            const fields = getFieldsOfModelOrField(model, field, fieldListItem);
            const fieldsByName = _.keyBy(fields, 'name');
            modelKeyPath = _.concat(modelKeyPath, 'fields');
            _.forEach(value, (val, key) => {
                const field = _.get(fieldsByName, key, null);
                _iterateDeep({
                    value: val,
                    model: null,
                    field: field,
                    fieldListItem: null,
                    valueKeyPath: _.concat(valueKeyPath, key),
                    modelKeyPath: _.concat(modelKeyPath, key),
                    objectStack: _.concat(objectStack, value)
                });
            });
        } else if (_.isArray(value)) {
            let fieldListItems: FieldListItems | null = null;
            if (field && isListField(field)) {
                fieldListItems = getListFieldItems(field);
            } else if (model && isListDataModel(model)) {
                fieldListItems = model.items;
            }
            _.forEach(value, (val, idx) => {
                _iterateDeep({
                    value: val,
                    model: null,
                    field: null,
                    fieldListItem: fieldListItems,
                    valueKeyPath: _.concat(valueKeyPath, idx),
                    modelKeyPath: _.concat(modelKeyPath, 'items'),
                    objectStack: _.concat(objectStack, value)
                });
            });
        }
    }

    _iterateDeep({
        value: value,
        model: model,
        field: null,
        fieldListItem: null,
        valueKeyPath: valueId ? [valueId] : [],
        modelKeyPath: [model.name],
        objectStack: []
    });
}

export function mapObjectFieldsWithModelRecursively(
    value: any,
    model: Model,
    modelsByName: Record<string, Model>,
    iteratee: (options: {
        value: any;
        model: Model | null;
        field: Field | null;
        fieldListItem: FieldListItems | null;
        error: string | null;
        valueKeyPath: (string | number)[];
        modelKeyPath: string[];
        objectStack: any[];
    }) => any,
    { pageLayoutKey = 'layout', objectTypeKey = 'type', valueId }: { pageLayoutKey?: string; objectTypeKey?: string; valueId?: string } = {}
) {
    function _mapDeep({
        value,
        model,
        field,
        fieldListItem,
        valueKeyPath,
        modelKeyPath,
        objectStack
    }: {
        value: any;
        model: Model | null;
        field: Field | null;
        fieldListItem: FieldListItems | null;
        valueKeyPath: (string | number)[];
        modelKeyPath: string[];
        objectStack: any[];
    }) {
        let error: string | null = null;
        let modelField: FieldModelProps | null = null;

        if (!model && !field && !fieldListItem) {
            error = `could not match model/field ${modelKeyPath.join('.')} to content at ${valueKeyPath.join('.')}`;
        }

        if (field && isModelField(field)) {
            modelField = field;
        } else if (fieldListItem && isModelListItems(fieldListItem)) {
            modelField = fieldListItem;
        }

        if (modelField) {
            const modelResult = getModelOfObject({
                object: value,
                field: modelField,
                modelsByName,
                pageLayoutKey,
                objectTypeKey,
                valueKeyPath,
                modelKeyPath
            });
            if ('error' in modelResult) {
                error = modelResult.error;
            } else {
                model = modelResult.model;
            }
            field = null;
            fieldListItem = null;
            modelKeyPath = model ? [model.name] : [];
        }

        const res = iteratee({ value, model, field, fieldListItem, error, valueKeyPath, modelKeyPath, objectStack });
        if (!_.isUndefined(res)) {
            value = res;
        }

        if (_.isPlainObject(value)) {
            // if fields will not be resolved or the object will have a key that
            // doesn't exist among fields, the nested calls to _iterateDeep will
            // include an error.
            const fields = getFieldsOfModelOrField(model, field, fieldListItem);
            const fieldsByName = _.keyBy(fields, 'name');
            modelKeyPath = _.concat(modelKeyPath, 'fields');
            value = _.mapValues(value, (val, key) => {
                const field = _.get(fieldsByName, key, null);
                return _mapDeep({
                    value: val,
                    model: null,
                    field: field,
                    fieldListItem: null,
                    valueKeyPath: _.concat(valueKeyPath, key),
                    modelKeyPath: _.concat(modelKeyPath, key),
                    objectStack: _.concat(objectStack, value)
                });
            });
        } else if (_.isArray(value)) {
            let fieldListItems: FieldListItems | null = null;
            if (field && isListField(field)) {
                fieldListItems = getListFieldItems(field);
            } else if (model && isListDataModel(model)) {
                fieldListItems = model.items;
            }
            value = _.map(value, (val, idx) => {
                return _mapDeep({
                    value: val,
                    model: null,
                    field: null,
                    fieldListItem: fieldListItems,
                    valueKeyPath: _.concat(valueKeyPath, idx),
                    modelKeyPath: _.concat(modelKeyPath, 'items'),
                    objectStack: _.concat(objectStack, value)
                });
            });
        }

        return value;
    }

    return _mapDeep({
        value: value,
        model: model,
        field: null,
        fieldListItem: null,
        valueKeyPath: valueId ? [valueId] : [],
        modelKeyPath: [model.name],
        objectStack: []
    });
}

export function getModelOfObject({
    object,
    field,
    modelsByName,
    pageLayoutKey,
    objectTypeKey,
    valueKeyPath,
    modelKeyPath
}: {
    object: any;
    field: FieldModelProps;
    modelsByName: Record<string, Model>;
    pageLayoutKey: string;
    objectTypeKey: string;
    valueKeyPath: (string | number)[];
    modelKeyPath: string[];
}): { modelName: string; model: Model } | { error: string } {
    const modelNames = field.models ?? [];
    let modelName: string;
    if (modelNames.length === 0) {
        return { error: `invalid field, no 'models' property specified at '${modelKeyPath.join('.')}'` };
    }
    if (modelNames.length === 1) {
        modelName = modelNames[0]!;
        if (!_.has(modelsByName, modelName)) {
            return { error: `invalid field, model name '${modelName}' specified at '${modelKeyPath.join('.')}' doesn't match any model` };
        }
    } else {
        // we don't know if the object at hand belongs to a model of type "page" or type "data"
        // so we try to get the model using both pageLayoutKey and objectTypeKey keys
        if (!_.has(object, pageLayoutKey) && !_.has(object, objectTypeKey)) {
            return { error: `cannot identify the model of an object, no '${pageLayoutKey}' or '${objectTypeKey}' field exist at ${valueKeyPath.join('.')}` };
        }
        modelName = object[pageLayoutKey] || object[objectTypeKey];
        if (!_.has(modelsByName, modelName)) {
            const typeKey = object[pageLayoutKey] ? pageLayoutKey : objectTypeKey;
            return { error: `invalid content, '${typeKey}=${modelName}' specified at ${valueKeyPath.join('.')} doesn't match any model` };
        }
    }
    return {
        modelName,
        model: modelsByName[modelName]!
    };
}

function getFieldsOfModelOrField(model: Model | null, field: Field | null, fieldListItems: FieldListItems | null): Field[] {
    if (model && model.fields) {
        return model.fields;
    } else if (field && isObjectField(field)) {
        return field.fields;
    } else if (fieldListItems && isObjectListItems(fieldListItems)) {
        return fieldListItems.fields;
    }
    return [];
}
