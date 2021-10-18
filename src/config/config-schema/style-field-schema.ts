import Joi, { CustomHelpers, ErrorReport } from 'joi';
import _ from 'lodash';
import { Field } from '../config-types';
import { STYLE_PROPS_VALUES } from '../config-consts';

const sizePattern = /^[xylrtb](?:\d+(?::\d+(?::\d+)?)?)?|\d+(?::\d+(?::\d+)?)?|tw[xylrtb]?(?:\d+|\d\.5|px)?$/;
const styleSizeSchema = stylePropWithAll(Joi.array().items(Joi.string().pattern(sizePattern)).single()).prefs({
    messages: {
        'string.pattern.base':
            'Invalid field name "{{#value}}" at "{{#label}}". A field name must contain only alphanumeric characters, ' +
            'hyphens and underscores, must start and end with an alphanumeric character.'
    },
    errors: { wrap: { label: false } }
});

const fontWeightPattern = /^[1-8]00:[2-9]00$/;
const opacityPattern = /^[1-9]?[05]:(?:5|[1-9][05]|100)$/;

const styleColorSchema = arrayOf(
    Joi.object({
        value: Joi.string().required(),
        label: Joi.string().required(),
        color: Joi.string().required()
    })
);

const stylePropsSchema = Joi.object({
    objectFit: arrayOfStringsWithAll(...STYLE_PROPS_VALUES.objectFit),
    objectPosition: arrayOfStringsWithAll(...STYLE_PROPS_VALUES.nineRegions),
    flexDirection: arrayOfStringsWithAll(...STYLE_PROPS_VALUES.flexDirection),
    justifyContent: arrayOfStringsWithAll(...STYLE_PROPS_VALUES.justifyContent),
    justifyItems: arrayOfStringsWithAll(...STYLE_PROPS_VALUES.justifyItems),
    justifySelf: arrayOfStringsWithAll(...STYLE_PROPS_VALUES.justifySelf),
    alignContent: arrayOfStringsWithAll(...STYLE_PROPS_VALUES.alignContent),
    alignItems: arrayOfStringsWithAll(...STYLE_PROPS_VALUES.alignItems),
    alignSelf: arrayOfStringsWithAll(...STYLE_PROPS_VALUES.alignSelf),
    padding: styleSizeSchema,
    margin: styleSizeSchema,
    width: arrayOfStringsWithAll(...STYLE_PROPS_VALUES.width),
    height: arrayOfStringsWithAll(...STYLE_PROPS_VALUES.height),
    fontFamily: arrayOf(
        Joi.object({
            value: Joi.string().required(),
            label: Joi.string().required()
        })
    ),
    fontSize: arrayOfStringsWithAll(...STYLE_PROPS_VALUES.fontSize),
    fontStyle: arrayOfStringsWithAll(...STYLE_PROPS_VALUES.fontStyle),
    fontWeight: stylePropWithAll(
        Joi.string().pattern(fontWeightPattern),
        arrayOf(Joi.string().pattern(fontWeightPattern), Joi.string().valid(...STYLE_PROPS_VALUES.fontWeight))
    ),
    textAlign: arrayOfStringsWithAll(...STYLE_PROPS_VALUES.textAlign),
    textColor: styleColorSchema,
    textDecoration: arrayOfStringsWithAll(...STYLE_PROPS_VALUES.textDecoration),
    backgroundColor: styleColorSchema,
    backgroundPosition: arrayOfStringsWithAll(...STYLE_PROPS_VALUES.nineRegions),
    backgroundSize: arrayOfStringsWithAll(...STYLE_PROPS_VALUES.backgroundSize),
    borderRadius: arrayOfStringsWithAll(...STYLE_PROPS_VALUES.borderRadius),
    borderWidth: styleSizeSchema,
    borderColor: styleColorSchema,
    borderStyle: arrayOfStringsWithAll(...STYLE_PROPS_VALUES.borderStyle),
    boxShadow: arrayOfStringsWithAll(...STYLE_PROPS_VALUES.boxShadow),
    opacity: stylePropWithAll(
        Joi.string().pattern(opacityPattern),
        arrayOf(Joi.string().pattern(opacityPattern), Joi.number().integer().min(0).max(100).multiple(5))
    )
});

const styleFieldNotFound = 'style.field.not.found';

export const styleFieldPartialSchema = Joi.object({
    type: Joi.string().valid('style').required(),
    styles: Joi.object()
        .pattern(Joi.string(), stylePropsSchema)
        .custom((value, { error, state, errorsArray }: CustomHelpers & { errorsArray?: () => ErrorReport[] }) => {
            const fields: Field[] = _.nth(state.ancestors, 1)!;
            const fieldsByName = _.keyBy(fields, 'name');
            const errors = errorsArray!();
            _.forEach(value, (styleProps, fieldName) => {
                if (fieldName !== 'self' && !_.has(fieldsByName, fieldName)) {
                    errors.push(error(styleFieldNotFound, { fieldName }));
                    return;
                }
            });
            if (errors && errors.length) {
                return errors;
            }
            return value;
        })
        .required()
        .prefs({
            messages: {
                [styleFieldNotFound]: '{{#label}}.{{#fieldName}} does not match any model field name or the "self" keyword'
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
                    if (_.has(schema, 'allow')) {
                        const items: string[] = _.get(schema, 'allow', []);
                        localTypes.singleItems.push(...items.map((value) => `"${value}"`));
                    } else if (_.has(schema, 'rules') && _.some(schema.rules, { name: 'pattern' })) {
                        localTypes.singleItems.push(`${stylePropName} pattern`);
                    }
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

function arrayOfStringsWithAll(...values: string[]) {
    return stylePropWithAll(arrayOf(Joi.string().valid(...values)));
}

function stylePropWithAll(...items: Joi.Schema[]) {
    return Joi.alternatives()
        .try(Joi.string().valid('*'), ...items)
        .error(stylePropError as any);
}

function arrayOf(...items: Joi.Schema[]): Joi.Schema {
    return Joi.array().items(...items);
}
