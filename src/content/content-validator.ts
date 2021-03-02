import _ from 'lodash';

import { ContentItem } from './content-loader';
import { Config } from '../config/config-loader';
import { joiSchemaForModelName } from './content-schema';
import { ContentValidationError } from './content-errors';

interface ValidateContentOptions {
    contentItems: ContentItem[];
    config: Config;
}

export function validate({ contentItems, config }: ValidateContentOptions) {
    const errors: ContentValidationError[] = [];
    _.forEach(contentItems, (contentItem) => {
        const modelName = contentItem.__metadata.modelName;
        if (!modelName) {
            return;
        }
        const modelSchema = joiSchemaForModelName(modelName, config.models);
        const validationOptions = { abortEarly: false };
        const validationResult = modelSchema.validate(_.omit(contentItem, '__metadata'), validationOptions);
        const validationErrors = validationResult.error?.details.map((validationError) => {
            return new ContentValidationError({
                message: validationError.message,
                fieldPath: validationError.path,
                value: validationError.context?.value,
                filePath: contentItem.__metadata.filePath
            });
        });
        if (validationErrors) {
            errors.push(...validationErrors);
        }
    });
    return {
        valid: _.isEmpty(errors),
        errors
    };
}
