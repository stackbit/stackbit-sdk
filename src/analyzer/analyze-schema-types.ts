/**
 * This file extends the Stackbit schema with an "unknown" field type.
 * The "unknown" field type is used in intermediate steps when generating a new
 * schema from content files
 */

import {
    FieldCommonProps,
    FieldType,
    FieldSimpleProps,
    FieldEnumProps,
    FieldNumberProps,
    FieldObjectProps,
    FieldModelProps,
    FieldReferenceProps,
    FieldListProps,
    FieldListItems
} from '../config/config-types';

export type FieldWithUnknown =
    | FieldUnknown
    | FieldSimpleWithUnknown
    | FieldEnumWithUnknown
    | FieldNumberWithUnknown
    | FieldObjectWithUnknown
    | FieldModelWithUnknown
    | FieldReferenceWithUnknown
    | FieldListWithUnknown;

export type FieldUnknown = FieldCommonPropsWithUnknown & FieldUnknownProps;
export type FieldSimpleWithUnknown = FieldCommonPropsWithUnknown & FieldSimpleProps;
export type FieldEnumWithUnknown = FieldCommonPropsWithUnknown & FieldEnumProps;
export type FieldNumberWithUnknown = FieldCommonPropsWithUnknown & FieldNumberProps;
export type FieldObjectWithUnknown = FieldCommonPropsWithUnknown & FieldObjectPropsWithUnknown;
export type FieldModelWithUnknown = FieldCommonPropsWithUnknown & FieldModelProps;
export type FieldReferenceWithUnknown = FieldCommonPropsWithUnknown & FieldReferenceProps;
export type FieldListWithUnknown = FieldCommonPropsWithUnknown & FieldListPropsWithUnknown;

export type FieldCommonPropsWithUnknown = Omit<FieldCommonProps, 'type'> & {
    type: FieldTypeWithUnknown;
};

export type FieldTypeWithUnknown = 'unknown' | FieldType;

export interface FieldUnknownProps {
    type: 'unknown';
}

export type FieldObjectPropsWithUnknown = Omit<FieldObjectProps, 'fields'> & {
    fields: FieldWithUnknown[];
};

export type FieldListPropsWithUnknown = Omit<FieldListProps, 'items'> & {
    items?: FieldListItemsWithUnknown;
};

export type FieldListItemsWithUnknown = Exclude<FieldListItems, FieldObjectProps> | FieldUnknownProps | FieldObjectPropsWithUnknown;

export function isObjectWithUnknownField(field: FieldWithUnknown): field is FieldObjectWithUnknown {
    return field.type === 'object';
}

export function isListWithUnknownField(field: FieldWithUnknown): field is FieldListWithUnknown {
    return field.type === 'list';
}

export function isObjectListItemsWithUnknown(items: FieldListItemsWithUnknown): items is FieldObjectPropsWithUnknown {
    return items.type === 'object';
}

export function isModelListItemsWithUnknown(items: FieldListItemsWithUnknown): items is FieldModelProps {
    return items.type === 'model';
}
