const path = require('path');
const _ = require('lodash');
const { test, expect } = require('@jest/globals');

const { loadConfig } = require('../src/config/config-loader');
const { loadContent } = require('../src/content/content-loader');

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

describe('test errors of invalid content', () => {
    let configResult;
    let contentResult;

    beforeAll(async () => {
        const dirPath = path.join(__dirname, `./fixtures/content-with-errors`);
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
        expect(contentResult.errors).toHaveLength(14);
    });

    test('validation of model fields with invalid value type should fail', () => {
        const commonErrorFields = {
            type: 'string.base',
            modelName: 'config',
            filePath: 'data/config.json'
        };
        const errors = _.filter(contentResult.errors, ['modelName', 'config']).map((error) => _.pick(error, ['message', 'type', 'modelName', 'filePath', 'fieldPath']));
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
            { ...commonErrorFields, fieldPath: ['section', 'action', 'icon', 'icon_type'] }
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
        ]);
    })

    test('modelName is returned in metadata of invalid objects', async () => {
        const configItem = _.find(contentResult.contentItems, ['__metadata.modelName', 'config']);
        expect(configItem).toMatchObject(
            {
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
            }
        );
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
            filePath: 'content/contact.md'
        }
    ]);

    // const [modeledItems, unmodeledItems] = _.partition(contentResult.contentItems, (contentItem) => _.get(contentItem, '__metadata.modelName') !== null);
    expect(_.sortBy(contentResult.contentItems, '__metadata.filePath')).toMatchObject(_.sortBy([
        { __metadata: { filePath: 'content/about.md', modelName: 'about' } },
        { __metadata: { filePath: 'content/index.md', modelName: 'home' } },
        { __metadata: { filePath: 'content/contact.md', modelName: null } }
    ], '__metadata.filePath'));
});
