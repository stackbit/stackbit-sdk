import _ from 'lodash';
import { stackbitConfigSchema, YamlModel } from './config-schema';
import { Model } from './config-loader';

export interface ConfigValidationError {
    name: 'ConfigValidationError';
    type: string;
    message: string;
    fieldPath: (string | number)[];
    normFieldPath?: (string | number)[];
    value?: any;
}

export interface ConfigValidationResult {
    value: any;
    valid: boolean;
    errors: ConfigValidationError[];
}

export function validate(config: any): ConfigValidationResult {
    const validationOptions = { abortEarly: false };
    const validationResult = stackbitConfigSchema.validate(config, validationOptions);
    const value = validationResult.value;
    const joiErrors = validationResult.error?.details || [];
    const errors = joiErrors.map(
        (validationError): ConfigValidationError => {
            return {
                name: 'ConfigValidationError',
                type: validationError.type,
                message: validationError.message,
                fieldPath: validationError.path,
                value: validationError.context?.value
            };
        }
    );
    markInvalidModels(value, errors);
    const valid = _.isEmpty(errors);
    return {
        value,
        valid,
        errors
    };
}

function markInvalidModels(config: any, errors: ConfigValidationError[]) {
    const invalidModelNames = getInvalidModelNames(errors);
    const models = config.models ?? {};
    _.forEach(models, (model: any, modelName: string): any => {
        if (invalidModelNames.includes(modelName)) {
            _.set(model, '__metadata.invalid', true);
        }
    });
}

function getInvalidModelNames(errors: ConfigValidationError[]) {
    // get array of invalid model names by iterating errors and filtering these
    // having fieldPath starting with ['models', modelName]
    return _.reduce(
        errors,
        (modelNames: string[], error: ConfigValidationError) => {
            if (error.fieldPath[0] === 'models' && typeof error.fieldPath[1] == 'string') {
                const modelName = error.fieldPath[1];
                modelNames.push(modelName);
            }
            return modelNames;
        },
        []
    );
}
