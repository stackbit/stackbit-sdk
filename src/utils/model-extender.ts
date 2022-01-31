import _ from 'lodash';
import { copyIfNotSet } from '@stackbit/utils';

import { Model, YamlModel, ModelMap } from '../config/config-types';
import { ConfigValidationError } from '../config/config-errors';

export function extendModelArray(models: Model[]): { models: Model[]; errors: ConfigValidationError[] } {
    const memorized = _.memoize(extendModel, (model, modelName) => modelName);
    const modelsByName = _.keyBy(models, 'name');
    return _.reduce(
        models,
        (result: { models: Model[]; errors: ConfigValidationError[] }, model) => {
            // YamlModel is the same as Model just without 'name' and '__metadata' properties
            const { model: extendedModel, errors } = memorized(model, model.name, modelsByName as ModelMap);
            return {
                models: result.models.concat(extendedModel),
                errors: result.errors.concat(errors)
            };
        },
        { models: [], errors: [] }
    );
}

export function extendModelMap(models: ModelMap): { models: ModelMap; errors: ConfigValidationError[] } {
    const memorized = _.memoize(extendModel, (model, modelName) => modelName);
    return _.reduce(
        models,
        (result: { models: ModelMap; errors: ConfigValidationError[] }, model, modelName) => {
            const { model: extendedModel, errors } = memorized(model, modelName, models);
            return {
                models: _.assign(result.models, { [modelName]: extendedModel }),
                errors: result.errors.concat(errors)
            };
        },
        { models: {}, errors: [] }
    );
}

function extendModel<T extends Model | YamlModel>(
    model: T,
    modelName: string,
    modelsByName: ModelMap,
    _extendPath: string[] = []
): { model: T; errors: ConfigValidationError[] } {
    if (_.includes(_extendPath, modelName)) {
        return {
            model,
            errors: [
                new ConfigValidationError({
                    type: 'model.extends.circular',
                    message: `cyclic dependency detected in model extend tree: ${_extendPath.join(' -> ')} -> ${modelName}`,
                    fieldPath: [],
                    value: null
                })
            ]
        };
    }

    let _extends: any = _.get(model, 'extends');
    let fields = _.get(model, 'fields');

    if (!_extends) {
        return { model, errors: [] };
    }

    delete model['extends'];

    if (!_.isArray(_extends)) {
        _extends = [_extends];
    }

    if (!fields) {
        fields = [];
        model.fields = fields;
    }

    let errors: ConfigValidationError[] = [];

    _.forEach(_extends, (superModelName) => {
        const superModel = _.get(modelsByName, superModelName);
        if (!superModel) {
            errors.push(
                new ConfigValidationError({
                    type: 'model.extends.model.not.found',
                    message: `model '${modelName}' extends non existing model '${superModelName}'`,
                    fieldPath: [],
                    value: null
                })
            );
            return;
        }
        const { model: extendedSuperModel, errors: nestedErrors } = extendModel(superModel, superModelName, modelsByName, _extendPath.concat(modelName));
        errors = errors.concat(nestedErrors);
        copyIfNotSet(extendedSuperModel, 'hideContent', model, 'hideContent');
        copyIfNotSet(extendedSuperModel, 'singleInstance', model, 'singleInstance');
        copyIfNotSet(extendedSuperModel, 'labelField', model, 'labelField');
        copyIfNotSet(extendedSuperModel, 'variantField', model, 'variantField');
        if (Array.isArray(extendedSuperModel.fieldGroups) && extendedSuperModel.fieldGroups.length > 0) {
            model.fieldGroups = _.uniqBy(_.concat(extendedSuperModel.fieldGroups, _.get(model, 'fieldGroups', [])), 'name');
        }
        let idx = 0;
        _.forEach(extendedSuperModel.fields, (superField) => {
            const field = _.find(fields, { name: superField.name });
            superField = _.cloneDeep(superField);
            if (field) {
                _.defaults(field, superField);
            } else {
                fields!.splice(idx++, 0, superField);
            }
        });
    });

    return { model, errors };
}
