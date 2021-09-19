import _ from 'lodash';
import { copyIfNotSet } from '@stackbit/utils';

import { Model, YamlModel, ModelMap } from '../config/config-types';

export function extendModels(models: Model[]): Model[] {
    const memorized = _.memoize(extendModel, (model: YamlModel, modelName: string) => modelName);
    const modelsByName = _.keyBy(models, 'name');
    return _.map(models, (model) => {
        // YamlModel is the same as Model just without 'name' and '__metadata' properties
        return memorized(model as YamlModel, model.name, modelsByName) as Model;
    });
}

export function extendModelMap(models: ModelMap): ModelMap {
    const memorized = _.memoize(extendModel, (model: YamlModel, modelName: string) => modelName);
    return _.mapValues(models, (model, modelName) => {
        return memorized(model, modelName, models);
    });
}

function extendModel(model: YamlModel, modelName: string, modelsByName: Record<string, YamlModel>, _extendPath: string[] = []) {
    assert(!_.includes(_extendPath, modelName), `cyclic dependency detected in model extend tree: ${_extendPath.join(' -> ')} -> ${modelName}`);

    let _extends = _.get(model, 'extends');
    let fields = _.get(model, 'fields');

    if (!_extends) {
        return model;
    }

    delete model['extends'];

    if (!_.isArray(_extends)) {
        _extends = [_extends];
    }

    if (!fields) {
        fields = [];
        model.fields = fields;
    }

    _.forEach(_extends, (superModelName) => {
        let superModel = _.get(modelsByName, superModelName);
        assert(superModel, `model '${modelName}' extends non existing model '${superModelName}'`);
        assert(
            superModel.type === 'object',
            `model '${modelName}' extends models of type '${superModel.type}', only model of the 'object' type can be extended`
        );
        superModel = extendModel(superModel, superModelName, modelsByName, _extendPath.concat(modelName));
        copyIfNotSet(superModel, 'hideContent', model, 'hideContent');
        copyIfNotSet(superModel, 'singleInstance', model, 'singleInstance');
        copyIfNotSet(superModel, 'labelField', model, 'labelField');
        let idx = 0;
        _.forEach(superModel.fields, (superField) => {
            const field = _.find(fields, { name: superField.name });
            if (field) {
                _.defaultsDeep(field, _.cloneDeep(superField));
            } else {
                fields!.splice(idx++, 0, _.cloneDeep(superField));
            }
        });
    });

    return model;
}

function assert(value: any, message: string) {
    if (!value) {
        throw new Error(message);
    }
}
