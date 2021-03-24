declare module '@stackbit/schema' {
    import { Model } from './config/config-loader';
    import { Field, FieldList, FieldListItems, FieldObjectProps, FieldModel, FieldReference } from './config/config-schema';

    interface BaseModelQuery {
        filePath: string;
    }

    interface TypedModelQuery extends BaseModelQuery {
        type: string | null;
        modelTypeKeyPath: string | string[];
    }

    type ModelQuery = BaseModelQuery | TypedModelQuery;

    export function iterateModelFieldsRecursively(model: Model, iterator: (field: Field, fieldPath: string[]) => void): void;
    export function getModelsByQuery(query: ModelQuery, models: Model[]): Model[];
    export function extendModels(models: Model[]): Model[];
    export function isObjectField(field: Field): field is FieldObjectProps;
    export function isModelField(field: Field): field is FieldModel;
    export function isReferenceField(field: Field): field is FieldReference;
    export function isListField(field: Field): field is FieldList;
    export function getListItemsField(field: FieldList): FieldListItems;
}
