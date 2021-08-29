import _ from 'lodash';

import { Model, ConfigModel, DataModel, PageModel, ObjectModel } from '../config/config-loader';
import {
    FIELD_TYPES,
    Field,
    FieldModel,
    FieldObject,
    FieldReference,
    FieldList,
    FieldListItems,
    FieldObjectProps,
    FieldListObject,
    FieldListModel,
    FieldListReference, FieldReferenceProps, FieldModelProps
} from '../config/config-schema';

export function getModelByName(models: Model[], modelName: string): Model | undefined {
    return models.find((model) => model.name === modelName);
}

export function isConfigModel(model: Model): model is ConfigModel {
    return model.type === 'config';
}

export function isDataModel(model: Model): model is DataModel {
    return model.type === 'data';
}

export function isListDataModel(model: Model): model is DataModel & { isList: true } {
    return isDataModel(model) && Boolean(model.isList);
}

export function isPageModel(model: Model): model is PageModel {
    return model.type === 'page';
}

export function isObjectModel(model: Model): model is ObjectModel {
    return model.type === 'object';
}

export function isSingleInstanceModel(model: Model): boolean {
    if (model.type === 'config') {
        return true;
    } else if (model.type === 'data') {
        return _.has(model, 'file');
    } else if (model.type === 'page') {
        return _.has(model, 'file') || _.get(model, 'singleInstance', false);
    }
    return false;
}

export function isObjectField(field: Field): field is FieldObject {
    return field.type === 'object';
}

export function isModelField(field: Field): field is FieldModel {
    return field.type === 'model';
}

export function isReferenceField(field: Field): field is FieldReference {
    return field.type === 'reference';
}

export function isCustomModelField(field: Field, modelsByName: Record<string, Model>) {
    // custom model field types are deprecated
    return !FIELD_TYPES.includes(field.type) && _.has(modelsByName, field.type);
}

export function isListOfObjectsField(field: Field): field is FieldListObject {
    return isListField(field) && isObjectListItems(getListItemsField(field));
}

export function isListOfModelsField(field: Field): field is FieldListModel {
    return isListField(field) && isModelListItems(getListItemsField(field));
}

export function isListOfReferencesField(field: Field): field is FieldListReference {
    return isListField(field) && isReferenceListItems(getListItemsField(field));
}

export function isListOfCustomModelsField(field: Field, modelsByName?: Record<string, Model>): field is FieldList {
    // custom model field types are deprecated
    return isListField(field) && isCustomModelListItems(getListItemsField(field), modelsByName);
}

export function isListField(field: Field): field is FieldList {
    // 'array' is deprecated field type
    return ['list', 'array'].includes(field.type);
}

export function isObjectListItems(items: FieldListItems): items is FieldObjectProps {
    return items.type === 'object';
}

export function isModelListItems(items: FieldListItems): items is FieldModelProps {
    return items.type === 'model';
}

export function isReferenceListItems(items: FieldListItems): items is FieldReferenceProps {
    return items.type === 'reference';
}

export function isCustomModelListItems(items: FieldListItems, modelsByName?: Record<string, Model>) {
    // custom model field types are deprecated
    return !FIELD_TYPES.includes(items.type) && (!modelsByName || _.has(modelsByName, items.type));
}

/**
 * Gets a list field and returns its items field. If list field does not define
 * items field, the default field is string:
 *
 * @example
 * listItemField = getListItemsField({
 *   type: 'list',
 *   name: '...',
 *   items: { type: 'object', fields: [] }
 * }
 * listItemField => {
 *   type: 'object',
 *   name: '...',
 *   fields: []
 * }
 *
 * // list field without `items`
 * listItemField = getListItemsField({ type: 'list', name: '...' }
 * listItemField => { type: 'string' }
 *
 * @param {Object} field
 * @return {Object}
 */
export function getListItemsField(field: FieldList): FieldListItems {
    // items.type defaults to string
    return _.defaults(field.items, { type: 'string' });
}

export function assignLabelFieldIfNeeded(modelOrField: Model | FieldObjectProps) {
    if (modelOrField.labelField) {
        return;
    }
    const labelField = resolveLabelFieldForModel(modelOrField);
    if (labelField) {
        modelOrField.labelField = labelField;
    }
}

export function resolveLabelFieldForModel(modelOrField: Model | FieldObjectProps) {
    const fields = _.get(modelOrField, 'fields');
    let labelField = _.get(modelOrField, 'labelField', null);
    if (labelField) {
        return labelField;
    }
    // see if there is a field named 'title'
    let titleField = _.find(fields, (field) => field.name === 'title' && ['string', 'text'].includes(field.type));
    if (!titleField) {
        // see if there is a field named 'label'
        titleField = _.find(fields, (field) => field.name === 'label' && ['string', 'text'].includes(field.type));
    }
    if (!titleField) {
        // get the first 'string' field
        titleField = _.find(fields, { type: 'string' });
    }
    if (titleField) {
        labelField = _.get(titleField, 'name');
    }
    return labelField || null;
}
