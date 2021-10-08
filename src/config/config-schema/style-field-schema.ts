import Joi from 'joi';
import _ from 'lodash';
import { Field } from '../config-types';

const stylePropAllValues = Joi.string().valid('*');

const styleNineRegionsSchema = stylePropArrayOfStringsWithAll(
    'top',
    'center',
    'bottom',
    'left',
    'left-top',
    'left-bottom',
    'right',
    'right-top',
    'right-bottom'
);

const styleColorSchema = arrayItems(
    Joi.object({
        value: Joi.string().required(),
        label: Joi.string().required(),
        color: Joi.string().required()
    })
);

const sizePattern = /^[xylrtb](?:\d+(?::\d+(?::\d+)?)?)?|\d+(?::\d+(?::\d+)?)?|tw[xylrtb]?(?:\d+|\d\.5|px)?$/;
const styleSizeSchema = stylePropWithAll(Joi.array().items(Joi.string().pattern(sizePattern)).single()).prefs({
    messages: {
        'string.pattern.base':
            'Invalid field name "{{#value}}" at "{{#label}}". A field name must contain only alphanumeric characters, ' +
            'hyphens and underscores, must start and end with an alphanumeric character.'
    },
    errors: { wrap: { label: false } }
});

const stylePropsSchema = Joi.object({
    objectFit: stylePropArrayOfStringsWithAll('none', 'contain', 'cover', 'fill', 'scale-down'),
    objectPosition: styleNineRegionsSchema,
    flexDirection: stylePropArrayOfStringsWithAll('row', 'row-reverse', 'col', 'col-reverse'),
    justifyItems: stylePropArrayOfStringsWithAll('start', 'end', 'center', 'stretch'),
    justifySelf: stylePropArrayOfStringsWithAll('auto', 'start', 'end', 'center', 'stretch'),
    alignItems: stylePropArrayOfStringsWithAll('start', 'end', 'center', 'baseline', 'stretch'),
    alignSelf: stylePropArrayOfStringsWithAll('auto', 'start', 'end', 'center', 'baseline', 'stretch'),
    padding: styleSizeSchema,
    margin: styleSizeSchema,
    width: stylePropArrayOfStringsWithAll('auto', 'narrow', 'wide', 'full'),
    height: stylePropArrayOfStringsWithAll('auto', 'full', 'screen'),
    fontFamily: arrayItems(Joi.object({
        value: Joi.string().required(),
        label: Joi.string().required()
    })),
    fontSize: stylePropArrayOfStringsWithAll('xx-small', 'x-small', 'small', 'medium', 'large', 'x-large', 'xx-large', 'xxx-large'),
    fontStyle: stylePropArrayOfStringsWithAll('normal', 'italic'),
    fontWeight: stylePropWithAll(
        arrayItems(
            Joi.string().pattern(/^[1-9]00:[1-9]00$/),
            Joi.string().valid('100', '200', '300', '400', '500', '600', '700', '800', '900'),
            Joi.number().integer().min(100).max(900).multiple(100)
        )
    ),
    textAlign: stylePropArrayOfStringsWithAll('left', 'center', 'right', 'justify'),
    textColor: styleColorSchema,
    textDecoration: stylePropArrayOfStringsWithAll('none', 'underline', 'line-through'),
    backgroundColor: styleColorSchema,
    backgroundPosition: styleNineRegionsSchema,
    backgroundSize: stylePropArrayOfStringsWithAll('auto', 'cover', 'contain'),
    borderRadius: stylePropArrayOfStringsWithAll('xx-small', 'x-small', 'small', 'medium', 'large', 'x-large', 'xx-large', 'full'),
    borderWidth: styleSizeSchema,
    borderColor: styleColorSchema,
    borderStyle: stylePropArrayOfStringsWithAll('solid', 'dashed', 'dotted', 'double', 'none'),
    boxShadow: stylePropArrayOfStringsWithAll('none', 'x-small', 'small', 'medium', 'large', 'x-large', 'xx-large', 'inner'),
    opacity: stylePropWithAll(
        arrayItems(
            Joi.number().integer().min(0).max(100).multiple(5),
            Joi.string().pattern(/^[1-9]?[05]:(?:5|[1-9][05]|100)$/)
        )
    )
});

const styleFieldNotFound = 'style.field.not.found';

export const styleFieldPartialSchema = Joi.object({
    type: Joi.string().valid('style').required(),
    styles: Joi.object()
        .pattern(Joi.string(), stylePropsSchema)
        .custom((value, { error, state }) => {
            const fields: Field[] = _.nth(state.ancestors, 1)!;
            const fieldsByName = _.keyBy(fields, 'name');
            const illegalFieldNames: string[] = [];
            _.forEach(value, (styleProps, fieldName) => {
                if (fieldName !== 'self' && !_.has(fieldsByName, fieldName)) {
                    illegalFieldNames.push(fieldName);
                    return;
                }
            });
            if (illegalFieldNames.length > 0) {
                return error(styleFieldNotFound, { illegalFieldNames: illegalFieldNames.join(', ') });
            }
            return value;
        })
        .required()
        .prefs({
            messages: {
                [styleFieldNotFound]:
                    '{{#label}} key names must match model field names or the "self" keyword, the keys: [{{#illegalFieldNames}}] do not match any field names'
            },
            errors: { wrap: { label: false } }
        })
});

function stylePropError(errors: Joi.ErrorReport[]): Joi.ErrorReport[] {
    return _.map(errors, (error) => {
        if (!['alternatives.types', 'alternatives.match'].includes(error.code)) {
            return error;
        }
        const stylePropSchema = _.head(_.get(error, 'state.schemas'));
        const stylePropName = _.get(stylePropSchema, 'key');
        const stylePropJoiSchema: Joi.Schema = _.get(stylePropSchema, 'schema');
        if (!stylePropJoiSchema) {
            return error;
        }
        const schemaDescription = stylePropJoiSchema.describe();
        const matches = _.get(schemaDescription, 'matches');
        const localTypes = _.reduce(
            matches,
            (localTypes: { singleItems: string[]; arrayItems: string[] }, match) => {
                const schema = _.get(match, 'schema');
                const schemaType = _.get(schema, 'type');
                if (schemaType === 'string') {
                    const items: string[] = _.get(schema, 'allow', []);
                    localTypes.singleItems.push(...items.map((value) => `"${value}"`));
                } else if (schemaType === 'array') {
                    const schemaItems = _.get(schema, 'items');
                    _.forEach(schemaItems, (schemaItem) => {
                        if (schemaItem.type === 'string') {
                            if (_.has(schemaItem, 'allow')) {
                                const items: string[] = _.get(schemaItem, 'allow', []);
                                localTypes.arrayItems.push(...items.map((value) => `"${value}"`));
                            } else if (_.has(schemaItem, 'rules') && _.some(schemaItem.rules, { name: 'pattern' })) {
                                localTypes.singleItems.push(`array of ${stylePropName} pattern`);
                            }
                        } else if (schemaItem.type === 'number') {
                            localTypes.singleItems.push(`array of valid ${stylePropName} numeric values`);
                        }
                    });
                }
                return localTypes;
            },
            { singleItems: [], arrayItems: [] }
        );
        error.code = 'alternatives.types';
        _.set(error, 'local.types', [...localTypes.singleItems, ...(localTypes.arrayItems.length ? [`array of [${localTypes.arrayItems.join(', ')}]`] : [])]);
        return error;
    });
}

function stylePropArrayOfStringsWithAll(...values: string[]) {
    return stylePropWithAll(arrayItems(Joi.string().valid(...values)));
}

function stylePropWithAll(...items: Joi.Schema[]) {
    return Joi.alternatives()
        .try(stylePropAllValues, ...items)
        .error(stylePropError as any);
}

function arrayItems(...items: Joi.Schema[]) {
    return Joi.array().items(...items);
}
