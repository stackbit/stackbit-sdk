const path = require('path');
const _ = require('lodash');
const { describe, test, expect, beforeAll } = require('@jest/globals');

const { loadConfig } = require('../src/config/config-loader');
const { loadContent } = require('../src/content/content-loader');
const { expectContentPassingValidation, expectContentFailValidationAndMatchAllErrors } = require('./test-utils');

test.each(['azimuth', 'diy', 'starter'])('load %s stackbit.yaml', async (subfolder) => {
    const dirPath = path.join(__dirname, `./fixtures/${subfolder}`);
    const result = await loadConfig({ dirPath: dirPath });
    // expect(result.errors).toHaveLength(0);

    // TODO: make a full coverage test for validating content instead of using temp data
    if (subfolder === 'azimuth') {
        const contentResult = await loadContent({
            dirPath: dirPath,
            config: result.config,
            skipUnmodeledContent: false
        });
        expect(contentResult.valid).toBeTruthy();
        expect(contentResult.errors).toHaveLength(0);
    }
});

describe('test object types', () => {
    const models = () => ({
        page_model: {
            type: 'page',
            label: 'Page',
            fields: [{ type: 'string', name: 'title' }]
        },
        data_model: {
            type: 'data',
            label: 'Data',
            fields: [
                { type: 'string', name: 'title' },
                { type: 'model', name: 'single', models: ['object_1'] },
                { type: 'model', name: 'multi', models: ['object_1', 'object_2'] },
                { type: 'list', name: 'list_single', items: { type: 'model', models: ['object_1'] } },
                { type: 'list', name: 'list_multi', items: { type: 'model', models: ['object_1', 'object_2'] } }
            ]
        },
        object_1: {
            type: 'object',
            label: 'Object 1'
        },
        object_2: {
            type: 'object',
            label: 'Object 2'
        }
    });
    const pageMetadata = {
        modelName: 'page_model',
        filePath: 'file.json'
    };
    const dataMetadata = {
        modelName: 'data_model',
        filePath: 'file.json'
    };

    test('page objects with default pageLayoutKey should pass validation', () => {
        expectContentPassingValidation(
            {
                models: models()
            },
            [
                {
                    __metadata: pageMetadata,
                    layout: 'page_model',
                    title: 'hello'
                }
            ]
        );
    });

    test('page objects with overridden pageLayoutKey should pass validation', () => {
        expectContentPassingValidation(
            {
                pageLayoutKey: 'type',
                models: models()
            },
            [
                {
                    __metadata: pageMetadata,
                    type: 'page_model',
                    title: 'hello'
                }
            ]
        );
    });

    test('page objects without default pageLayoutKey should fail validation', () => {
        expectContentFailValidationAndMatchAllErrors(
            {
                models: models()
            },
            [
                {
                    __metadata: pageMetadata,
                    title: 'hello'
                }
            ],
            [
                {
                    name: 'ContentValidationError',
                    type: 'any.required',
                    message: '"layout" is required',
                    modelName: 'page_model',
                    fieldPath: ['layout']
                }
            ]
        );
    });

    test('page objects without overridden pageLayoutKey should fail validation', () => {
        expectContentFailValidationAndMatchAllErrors(
            {
                pageLayoutKey: 'type',
                models: models()
            },
            [
                {
                    __metadata: pageMetadata,
                    title: 'hello'
                }
            ],
            [
                {
                    name: 'ContentValidationError',
                    type: 'any.required',
                    message: '"type" is required',
                    modelName: 'page_model',
                    fieldPath: ['type']
                }
            ]
        );
    });

    test('data objects with default objectTypeKey should pass validation', () => {
        expectContentPassingValidation(
            {
                models: models()
            },
            [
                {
                    __metadata: dataMetadata,
                    type: 'data_model',
                    title: 'hello'
                }
            ]
        );
    });

    test('data objects with overridden objectTypeKey should pass validation', () => {
        expectContentPassingValidation(
            {
                objectTypeKey: 'kind',
                models: models()
            },
            [
                {
                    __metadata: dataMetadata,
                    kind: 'data_model',
                    title: 'hello'
                }
            ]
        );
    });

    test('data objects without default objectTypeKey should fail validation', () => {
        expectContentFailValidationAndMatchAllErrors(
            {
                models: models()
            },
            [
                {
                    __metadata: dataMetadata,
                    title: 'hello'
                }
            ],
            [
                {
                    name: 'ContentValidationError',
                    type: 'any.required',
                    message: '"type" is required',
                    modelName: 'data_model',
                    fieldPath: ['type']
                }
            ]
        );
    });

    test('data objects without overridden objectTypeKey should fail validation', () => {
        expectContentFailValidationAndMatchAllErrors(
            {
                objectTypeKey: 'kind',
                models: models()
            },
            [
                {
                    __metadata: dataMetadata,
                    title: 'hello'
                }
            ],
            [
                {
                    name: 'ContentValidationError',
                    type: 'any.required',
                    message: '"kind" is required',
                    modelName: 'data_model',
                    fieldPath: ['kind']
                }
            ]
        );
    });

    test('model field with single model with objectTypeKey should pass validation', () => {
        expectContentPassingValidation(
            {
                models: models()
            },
            [
                {
                    __metadata: dataMetadata,
                    type: 'data_model',
                    single: { type: 'object_1' }
                }
            ]
        );
    });

    test('model field with single model without objectTypeKey should pass validation', () => {
        expectContentPassingValidation(
            {
                models: models()
            },
            [
                {
                    __metadata: dataMetadata,
                    type: 'data_model',
                    single: {}
                }
            ]
        );
    });

    test('model field with multiple models with objectTypeKey should pass validation', () => {
        expectContentPassingValidation(
            {
                models: models()
            },
            [
                {
                    __metadata: dataMetadata,
                    type: 'data_model',
                    multi: { type: 'object_1' }
                }
            ]
        );
    });

    test('model field with multiple models without objectTypeKey should fail validation', () => {
        expectContentFailValidationAndMatchAllErrors(
            {
                models: models()
            },
            [
                {
                    __metadata: dataMetadata,
                    type: 'data_model',
                    multi: {}
                }
            ],
            [
                {
                    name: 'ContentValidationError',
                    type: 'alternatives.any',
                    message: 'multi.type is required and must be one of [object_1, object_2].',
                    modelName: 'data_model',
                    fieldPath: ['multi']
                }
            ]
        );
    });

    test('list of model field with single model with objectTypeKey should pass validation', () => {
        expectContentPassingValidation(
            {
                models: models()
            },
            [
                {
                    __metadata: dataMetadata,
                    type: 'data_model',
                    list_single: [{ type: 'object_1' }]
                }
            ]
        );
    });

    test('list of model field with single model without objectTypeKey should pass validation', () => {
        expectContentPassingValidation(
            {
                models: models()
            },
            [
                {
                    __metadata: dataMetadata,
                    type: 'data_model',
                    list_single: [{}]
                }
            ]
        );
    });

    test('list of model field with multiple models with objectTypeKey should pass validation', () => {
        expectContentPassingValidation(
            {
                models: models()
            },
            [
                {
                    __metadata: dataMetadata,
                    type: 'data_model',
                    list_multi: [{ type: 'object_1' }]
                }
            ]
        );
    });

    test('list of model field with multiple models without objectTypeKey should fail validation', () => {
        expectContentFailValidationAndMatchAllErrors(
            {
                models: models()
            },
            [
                {
                    __metadata: dataMetadata,
                    type: 'data_model',
                    list_multi: [{}]
                }
            ],
            [
                {
                    name: 'ContentValidationError',
                    type: 'alternatives.any',
                    message: 'list_multi[0].type is required and must be one of [object_1, object_2].',
                    modelName: 'data_model',
                    fieldPath: ['list_multi', 0]
                }
            ]
        );
    });
});

describe('test errors of invalid content', () => {
    let configResult;
    let contentResult;

    beforeAll(async () => {
        const dirPath = path.join(__dirname, './fixtures/content-with-errors');
        configResult = await loadConfig({ dirPath: dirPath });
        contentResult = await loadContent({
            dirPath: dirPath,
            config: configResult.config,
            skipUnmodeledContent: false
        });
    });

    test('config is valid, content is invalid', () => {
        expect(configResult.valid).toBeTruthy();
        expect(configResult.errors).toHaveLength(0);
        expect(contentResult.valid).toBeFalsy();
        expect(contentResult.errors).toHaveLength(16);
    });

    test('validation of model fields with invalid value type should fail', () => {
        const commonErrorFields = {
            type: 'string.base',
            modelName: 'config',
            filePath: 'data/config.json'
        };
        const errors = _.filter(contentResult.errors, ['modelName', 'config']).map((error) =>
            _.pick(error, ['message', 'type', 'modelName', 'filePath', 'fieldPath'])
        );
        expect(errors).toMatchObject([
            { ...commonErrorFields, fieldPath: ['title'] },
            { ...commonErrorFields, fieldPath: ['action', 'label'] },
            { ...commonErrorFields, fieldPath: ['action', 'icon', 'icon_type'] },
            { ...commonErrorFields, fieldPath: ['action', 'icon', 'icon_color'], type: 'any.only' },
            { ...commonErrorFields, fieldPath: ['actions', 0, 'label'] },
            { ...commonErrorFields, fieldPath: ['actions', 0, 'icon', 'icon_type'] },
            { ...commonErrorFields, fieldPath: ['actions', 1, 'label'] },
            { ...commonErrorFields, fieldPath: ['actions', 1, 'icon', 'icon_type'] },
            { ...commonErrorFields, fieldPath: ['section', 'title'] },
            { ...commonErrorFields, fieldPath: ['section', 'action', 'label'] },
            { ...commonErrorFields, fieldPath: ['section', 'action', 'icon', 'icon_type'] },
            { type: 'any.required', modelName: 'config', filePath: 'data/config.json', fieldPath: ['type'] }
        ]);
    });

    test('objects of model fields with more than one model without type should be invalid', () => {
        const errors = _.filter(contentResult.errors, ['modelName', 'data_model_1']);
        const commonErrorFields = {
            type: 'alternatives.any',
            modelName: 'data_model_1',
            filePath: 'data/poly-data.json'
        };
        expect(errors).toMatchObject([
            { ...commonErrorFields, fieldPath: ['poly_model_list', 0], value: { __metadata: { modelName: null } } },
            { ...commonErrorFields, fieldPath: ['poly_model_list', 1], value: { __metadata: { modelName: null } } },
            { ...commonErrorFields, fieldPath: ['poly_model_list', 2, 'object_model_2_string'], type: 'string.base', value: 1 },
            { type: 'any.required', modelName: 'data_model_1', filePath: 'data/poly-data.json', fieldPath: ['type'] }
        ]);
    });

    test('modelName is returned in metadata of invalid objects', async () => {
        const configItem = _.find(contentResult.contentItems, ['__metadata.modelName', 'config']);
        expect(configItem).toMatchObject({
            __metadata: { modelName: 'config' },
            action: {
                __metadata: { modelName: 'action' },
                icon: { __metadata: { modelName: 'icon' } }
            },
            actions: [
                {
                    __metadata: { modelName: 'action' },
                    icon: { __metadata: { modelName: 'icon' } }
                },
                {
                    __metadata: { modelName: 'action' },
                    icon: { __metadata: { modelName: 'icon' } }
                }
            ],
            section: {
                action: {
                    __metadata: { modelName: 'action' },
                    icon: { __metadata: { modelName: 'icon' } }
                }
            }
        });
    });
});

test('invalid models should not affect loading and matching content to valid models', async () => {
    const dirPath = path.join(__dirname, 'fixtures/schema-with-errors');
    const result = await loadConfig({ dirPath: dirPath });

    const contentResult = await loadContent({
        dirPath: dirPath,
        config: result.config,
        skipUnmodeledContent: false
    });

    const errors = contentResult.errors.map((error) => _.pick(error, ['message', 'filePath']));

    expect(contentResult.valid).toBeFalsy();
    expect(errors).toMatchObject([
        {
            message: "file 'content/contact.md' matches several models 'invalid_1, invalid_2, invalid_3, home, page'",
            filePath: 'content/contact.md'
        }
    ]);

    // const [modeledItems, unmodeledItems] = _.partition(contentResult.contentItems, (contentItem) => _.get(contentItem, '__metadata.modelName') !== null);
    expect(_.sortBy(contentResult.contentItems, '__metadata.filePath')).toMatchObject(
        _.sortBy(
            [
                { __metadata: { filePath: 'content/about.md', modelName: 'about' } },
                { __metadata: { filePath: 'content/index.md', modelName: 'home' } },
                { __metadata: { filePath: 'content/contact.md', modelName: null } }
            ],
            '__metadata.filePath'
        )
    );
});
