import Joi from 'joi';
import _ from 'lodash';

import { ContentItem } from './content-loader';
import { joiSchemasForModels } from './content-schema';
import { ContentValidationError } from './content-errors';
import { getModelByName, isConfigModel, isDataModel, isListDataModel, isPageModel } from '../utils';
import { Config } from '../config/config-types';

interface ContentValidationOptions {
    contentItems: ContentItem[];
    config: Config;
}

interface ContentValidationResult {
    valid: boolean;
    value: ContentItem[];
    errors: ContentValidationError[];
}

export function validateContentItems({ contentItems, config }: ContentValidationOptions): ContentValidationResult {
    const errors: ContentValidationError[] = [];

    const joiModelSchemas = joiSchemasForModels(config);

    const value = _.map(
        contentItems,
        (contentItem): ContentItem => {
            const modelName = contentItem.__metadata?.modelName;
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

            const model = getModelByName(config.models, modelName);
            if (model) {
                if (isConfigModel(model)) {
                    if (config.ssgName === 'unibit') {
                        // in Unibit, config model defines the model of the params
                        modelSchema = Joi.object({ params: modelSchema });
                    }
                    // in config models allow skip root fields
                    modelSchema = modelSchema.unknown();
                } else if (isPageModel(model) && model.layout) {
                    const pageLayoutKey = config.pageLayoutKey || 'layout';
                    if (!_.find(model.fields, { name: pageLayoutKey })) {
                        modelSchema = modelSchema.keys({ [pageLayoutKey]: Joi.string().valid(model.layout) });
                    }
                } else if (isDataModel(model) && !isListDataModel(model)) {
                    const objectTypeKey = config.objectTypeKey || 'type';
                    if (!_.find(model.fields, { name: objectTypeKey })) {
                        modelSchema = modelSchema.keys({ [objectTypeKey]: Joi.string().valid(model.name) });
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
