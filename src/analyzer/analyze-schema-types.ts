/**
 * This file extends the Stackbit schema with an "unknown" field type.
 * The "unknown" field type is used in intermediate steps when generating a new
 * schema from content files
 */

import { StricterUnion } from '../utils';
import {
    FieldCommonProps,
    FieldEnumProps,
    FieldModelProps,
    FieldNumberProps,
    FieldType,
    FieldReferenceProps,
    FieldSimpleNoProps
} from '../config/config-schema';

export type FieldTypeWithUnknown = FieldType | 'unknown';
export type FieldListItemsTypeWithUnknown = Exclude<FieldTypeWithUnknown, 'list'>;

export interface FieldUnknownProps {
    type: 'unknown';
}

export interface FieldListPropsWithUnknown {
    type: 'list';
    items?: FieldListItemsWithUnknown;
}

export interface FieldObjectPropsWithUnknown {
    type: 'object';
    labelField?: string;
    fields: FieldWithUnknown[];
}

export type NonStrictFieldPartialPropsWithUnknown =
    | FieldUnknownProps
    | FieldEnumProps
    | FieldObjectPropsWithUnknown
    | FieldListPropsWithUnknown
    | FieldNumberProps
    | FieldModelProps
    | FieldReferenceProps
    | FieldSimpleNoProps;

export type FieldPartialPropsWithUnknown = StricterUnion<NonStrictFieldPartialPropsWithUnknown>;
export type FieldListItemsWithUnknown = StricterUnion<Exclude<NonStrictFieldPartialPropsWithUnknown, FieldListPropsWithUnknown>>;
export type FieldObjectWithUnknown = FieldObjectPropsWithUnknown & FieldCommonProps;
export type FieldListWithUnknown = FieldListPropsWithUnknown & FieldCommonProps;
export type FieldWithUnknown = FieldPartialPropsWithUnknown & FieldCommonProps;
