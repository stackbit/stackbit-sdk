import _ from 'lodash';

import { ContentItem } from './content-loader';
import { Config } from '../config/config-loader';
import { joiSchemasForModels } from './content-schema';
import { ContentValidationError } from './content-errors';
import { getModelByName, isConfigModel, isPageModel } from '../schema-utils';
import Joi from 'joi';

interface ValidateContentOptions {
    contentItems: ContentItem[];
    config: Config;
}

export function validate({ contentItems, config }: ValidateContentOptions) {
    const errors: ContentValidationError[] = [];

    const joiModelSchemas = joiSchemasForModels(config.models);

    _.forEach(contentItems, (contentItem) => {
        const modelName = contentItem.__metadata.modelName;
        if (!modelName) {
            return;
        }
        let modelSchema = joiModelSchemas[modelName];
        if (!modelSchema) {
            return;
        }
        const validationOptions = {
            abortEarly: false,
            context: {
                filePath: contentItem.__metadata.filePath
            }
        };

        const model = getModelByName(modelName, config.models);
        if (model) {
            if (isConfigModel(model)) {
                if (config.ssgName === 'unibit') {
                    // in Unibit, config model defines the model of the params
                    modelSchema = Joi.object({ params: modelSchema });
                }
                // in config models allow skip root fields
                modelSchema = modelSchema.unknown();
            } else if (isPageModel(model)) {
                if (config.ssgName === 'unibit') {
                    // in Unibit, every page has implicit layout field which must be equal to model name
                    modelSchema = modelSchema.keys({ layout: Joi.string().valid(modelName).required() });
                }
            }
        }

        const validationResult = modelSchema.validate(_.omit(contentItem, '__metadata'), validationOptions);
        const validationErrors = validationResult.error?.details.map((validationError) => {
            return new ContentValidationError({
                type: validationError.type,
                message: validationError.message,
                fieldPath: validationError.path,
                modelName: modelName,
                value: validationError.context?.value,
                filePath: contentItem.__metadata.filePath
            });
        });
        if (validationErrors) {
            errors.push(...validationErrors);
        }
    });
    const valid = _.isEmpty(errors);
    return {
        valid,
        errors
    };
}
