import {
    Model,
    ConfigModel,
    DataModel,
    PageModel,
    ObjectModel
} from './config/config-loader';

export function isConfigModel(model: Model): model is ConfigModel {
    return model.type === 'config';
}

export function isDataModel(model: Model): model is DataModel {
    return model.type === 'data';
}

export function isPageModel(model: Model): model is PageModel {
    return model.type === 'page';
}

export function isObjectModel(model: Model): model is ObjectModel {
    return model.type === 'object';
}
