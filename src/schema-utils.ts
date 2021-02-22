import {
    IModel,
    IConfigModel,
    IDataModel,
    IPageModel,
    IObjectModel
} from './config/config-loader';

export function isConfigModel(model: IModel): model is IConfigModel {
    return model.type === 'config';
}

export function isDataModel(model: IModel): model is IDataModel {
    return model.type === 'data';
}

export function isPageModel(model: IModel): model is IPageModel {
    return model.type === 'page';
}

export function isObjectModel(model: IModel): model is IObjectModel {
    return model.type === 'object';
}
