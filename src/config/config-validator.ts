import _ from 'lodash';

import { stackbitConfigSchema } from './config-schema';

export function validate(config: any) {
    const validationOptions = { abortEarly: false };
    const validationResult = stackbitConfigSchema.validate(config, validationOptions);
    const joiErrors = validationResult.error?.details || [];
    const errors = joiErrors.map((validationError) => {
        return {
            message: validationError.message,
            path: validationError.path,
            value: validationError.context?.value,
        };
    });
    return {
        valid: _.isEmpty(errors),
        errors
    };
}
