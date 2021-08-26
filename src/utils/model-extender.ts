import _ from 'lodash';
import { copyIfNotSet } from '@stackbit/utils';

import { Model } from '../config/config-loader';

export function extendModels(models: Model[]): Model[] {
    const memorized = _.memoize(extendModel, (model: Model) => model.name);
    const modelsByName = _.keyBy(models, 'name');
    return _.map(models, (model) => {
        return memorized(model, modelsByName);
    });
}

function extendModel(model: Model, modelsByName: Record<string, Model>, _extendPath: string[] = []) {
    assert(!_.includes(_extendPath, model.name), `cyclic dependency detected in model extend tree: ${_extendPath.join(' -> ')} -> ${model.name}`);

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
        assert(superModel, `model '${model.name}' extends non defined model '${superModelName}'`);
        assert(superModel.type === 'object', `only object model types can be extended`);
        superModel = extendModel(superModel, modelsByName, _extendPath.concat(model.name));
        copyIfNotSet(superModel, 'hideContent', model, 'hideContent');
        copyIfNotSet(superModel, 'singleInstance', model, 'singleInstance');
        copyIfNotSet(superModel, 'labelField', model, 'labelField');
        let idx = 0;
        _.forEach(superModel.fields, (superField) => {
            let field = _.find(fields, { name: superField.name });
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
