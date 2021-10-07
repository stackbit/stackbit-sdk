import _ from 'lodash';
import Joi from 'joi';

import { stackbitConfigSchema, contentModelsSchema } from './config-schema';
import { ConfigValidationError } from './config-errors';

export interface ConfigValidationResult {
    value: any;
    valid: boolean;
    errors: ConfigValidationError[];
}

export function validateConfig(config: any): ConfigValidationResult {
    const validationOptions = { abortEarly: false };
    const validationResult = stackbitConfigSchema.validate(config, validationOptions);
    const value = validationResult.value;
    const errors = mapJoiErrorsToConfigValidationErrors(validationResult);
    const valid = _.isEmpty(errors);
    markInvalidModels(value, errors, 'models');
    return {
        value,
        valid,
        errors
    };
}

export function validateContentModels(contentModels: any, models: any): ConfigValidationResult {
    const validationResult = contentModelsSchema.validate(
        { contentModels: contentModels },
        {
            abortEarly: false,
            context: {
                models: models
            }
        }
    );
    const value = validationResult.value;
    const errors = mapJoiErrorsToConfigValidationErrors(validationResult);
    const valid = _.isEmpty(errors);
    markInvalidModels(value, errors, 'contentModels');
    return {
        value,
        valid,
        errors
    };
}

function mapJoiErrorsToConfigValidationErrors(validationResult: Joi.ValidationResult): ConfigValidationError[] {
    const joiErrors = validationResult.error?.details || [];
    return joiErrors.map(
        (validationError): ConfigValidationError => {
            return new ConfigValidationError({
                type: validationError.type,
                message: validationError.message,
                fieldPath: validationError.path,
                value: validationError.context?.value
            });
        }
    );
}

function markInvalidModels(config: any, errors: ConfigValidationError[], configKey: string) {
    const invalidModelNames = getInvalidModelNames(errors, configKey);
    const models = config[configKey] ?? {};
    _.forEach(models, (model: any, modelName: string): any => {
        if (invalidModelNames.includes(modelName)) {
            _.set(model, '__metadata.invalid', true);
        }
    });
}

function getInvalidModelNames(errors: ConfigValidationError[], configKey: string) {
    // get array of invalid model names by iterating errors and filtering these
    // having fieldPath starting with ['models', modelName]
    return _.reduce(
        errors,
        (modelNames: string[], error: ConfigValidationError) => {
            if (error.fieldPath[0] === configKey && typeof error.fieldPath[1] == 'string') {
                const modelName = error.fieldPath[1];
                modelNames.push(modelName);
            }
            return modelNames;
        },
        []
    );
}
