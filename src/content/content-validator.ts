import _ from 'lodash';

import { ContentItem } from './content-loader';
import { Config } from '../config/config-loader';
import { joiSchemasForModels } from './content-schema';
import { ContentValidationError } from './content-errors';
import { getModelByName, isConfigModel, isPageModel } from '../schema-utils';
import Joi from 'joi';

interface ContentValidationOptions {
    contentItems: ContentItem[];
    config: Config;
}

interface ContentValidationResult {
    valid: boolean;
    value: ContentItem[];
    errors: ContentValidationError[];
}

export function validate({ contentItems, config }: ContentValidationOptions): ContentValidationResult {
    const errors: ContentValidationError[] = [];

    const joiModelSchemas = joiSchemasForModels(config.models);

    const value = _.map(
        contentItems,
        (contentItem): ContentItem => {
            const modelName = contentItem.__metadata.modelName;
            if (!modelName) {
                return contentItem;
            }
            let modelSchema = joiModelSchemas[modelName];
            if (!modelSchema) {
                return contentItem;
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
                modelSchema = modelSchema.keys({
                    __metadata: Joi.object({
                        filePath: Joi.string().required(),
                        modelName: Joi.string().valid(model.name).required()
                    }).required()
                });
            }

            const validationResult = modelSchema.validate(contentItem, validationOptions);
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
            return validationResult.value;
        }
    );
    const valid = _.isEmpty(errors);
    return {
        valid,
        value,
        errors
    };
}
