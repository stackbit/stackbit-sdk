import _ from 'lodash';
import { stackbitConfigSchema } from './config-schema';

export interface ConfigValidationError {
    name: 'ConfigValidationError';
    type: string;
    message: string;
    fieldPath: (string | number)[];
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
    const valid = _.isEmpty(errors);
    return {
        value,
        valid,
        errors
    };
}
