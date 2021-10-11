const path = require('path');
const { describe, test, expect, beforeAll } = require('@jest/globals');
const _ = require('lodash');

const modelUtils = require('../src/utils/model-utils');
const { loadConfig } = require('../src/config/config-loader');

describe('test model utils', () => {
    let result;
    beforeAll(async () => {
        const stackbitYamlPath = path.join(__dirname, 'fixtures/stackbit-v0.3.0');
        result = await loadConfig({ dirPath: stackbitYamlPath });
    });

    test('config loaded', () => {
        expect(result.valid).toBeTruthy();
    });

    test('getModelByName should return correct model', () => {
        const model = modelUtils.getModelByName(result.config.models, 'data_model_1');
        expect(model.name).toEqual('data_model_1');
    });

    test('isConfigModel should return true for config models only', () => {
        const configModel = modelUtils.getModelByName(result.config.models, 'config_model');
        const dataModel = modelUtils.getModelByName(result.config.models, 'data_model_1');
        const pageModel = modelUtils.getModelByName(result.config.models, 'page_model_1');
        const objectModel = modelUtils.getModelByName(result.config.models, 'object_model_1');
        expect(modelUtils.isConfigModel(configModel)).toBeTruthy();
        expect(modelUtils.isConfigModel(dataModel)).toBeFalsy();
        expect(modelUtils.isConfigModel(pageModel)).toBeFalsy();
        expect(modelUtils.isConfigModel(objectModel)).toBeFalsy();
    });

    test('isPageModel should return true for data models only', () => {
        const configModel = modelUtils.getModelByName(result.config.models, 'config_model');
        const dataModel = modelUtils.getModelByName(result.config.models, 'data_model_1');
        const pageModel = modelUtils.getModelByName(result.config.models, 'page_model_1');
        const objectModel = modelUtils.getModelByName(result.config.models, 'object_model_1');
        expect(modelUtils.isPageModel(configModel)).toBeFalsy();
        expect(modelUtils.isPageModel(dataModel)).toBeFalsy();
        expect(modelUtils.isPageModel(pageModel)).toBeTruthy();
        expect(modelUtils.isPageModel(objectModel)).toBeFalsy();
    });

    test('isDataModel should return true for data models only', () => {
        const configModel = modelUtils.getModelByName(result.config.models, 'config_model');
        const dataModel = modelUtils.getModelByName(result.config.models, 'data_model_1');
        const pageModel = modelUtils.getModelByName(result.config.models, 'page_model_1');
        const objectModel = modelUtils.getModelByName(result.config.models, 'object_model_1');
        expect(modelUtils.isDataModel(configModel)).toBeFalsy();
        expect(modelUtils.isDataModel(dataModel)).toBeTruthy();
        expect(modelUtils.isDataModel(pageModel)).toBeFalsy();
        expect(modelUtils.isDataModel(objectModel)).toBeFalsy();
    });

    test('isListDataModel should return true for data list models only', () => {
        const dataListModel = modelUtils.getModelByName(result.config.models, 'data_list_model_1');
        const configModel = modelUtils.getModelByName(result.config.models, 'config_model');
        const dataModel = modelUtils.getModelByName(result.config.models, 'data_model_1');
        const pageModel = modelUtils.getModelByName(result.config.models, 'page_model_1');
        const objectModel = modelUtils.getModelByName(result.config.models, 'object_model_1');
        expect(modelUtils.isListDataModel(dataListModel)).toBeTruthy();
        expect(modelUtils.isListDataModel(configModel)).toBeFalsy();
        expect(modelUtils.isListDataModel(dataModel)).toBeFalsy();
        expect(modelUtils.isListDataModel(pageModel)).toBeFalsy();
        expect(modelUtils.isListDataModel(objectModel)).toBeFalsy();
    });

    test('isObjectModel should return true for object models only', () => {
        const configModel = modelUtils.getModelByName(result.config.models, 'config_model');
        const dataModel = modelUtils.getModelByName(result.config.models, 'data_model_1');
        const pageModel = modelUtils.getModelByName(result.config.models, 'page_model_1');
        const objectModel = modelUtils.getModelByName(result.config.models, 'object_model_1');
        expect(modelUtils.isObjectModel(configModel)).toBeFalsy();
        expect(modelUtils.isObjectModel(dataModel)).toBeFalsy();
        expect(modelUtils.isObjectModel(pageModel)).toBeFalsy();
        expect(modelUtils.isObjectModel(objectModel)).toBeTruthy();
    });

    test('isSingleInstanceModel should return true for config model, data and page with file property', () => {
        const configModel = modelUtils.getModelByName(result.config.models, 'config_model');
        const dataModelFile = modelUtils.getModelByName(result.config.models, 'data_model_file');
        const pageModelFile = modelUtils.getModelByName(result.config.models, 'page_model_file');
        const dataModel = modelUtils.getModelByName(result.config.models, 'data_model_1');
        const pageModel = modelUtils.getModelByName(result.config.models, 'page_model_1');
        expect(modelUtils.isSingleInstanceModel(configModel)).toBeTruthy();
        expect(modelUtils.isSingleInstanceModel(dataModelFile)).toBeTruthy();
        expect(modelUtils.isSingleInstanceModel(pageModelFile)).toBeTruthy();
        expect(modelUtils.isSingleInstanceModel(dataModel)).toBeFalsy();
        expect(modelUtils.isSingleInstanceModel(pageModel)).toBeFalsy();
    });

    test('getListItemsField returns list items field', () => {
        const pageModel = modelUtils.getModelByName(result.config.models, 'page_model_1');
        const modelListField = _.find(pageModel.fields, ['name', 'model_list']);
        expect(modelUtils.getListItemsField(modelListField)).toMatchObject(modelListField.items);
    });
});
