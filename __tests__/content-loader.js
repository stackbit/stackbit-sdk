const path = require('path');
const _ = require('lodash');
const { test, expect } = require('@jest/globals');

const { loadConfig } = require('../src/config/config-loader');
const { loadContent } = require('../src/content/content-loader');

test.each(['azimuth', 'diy', 'starter'])('load %s stackbit.yaml', async (subfolder) => {
    const dirPath = path.join(__dirname, `./data/${subfolder}`);
    const result = await loadConfig({ dirPath: dirPath });
    // expect(result.errors).toHaveLength(0);

    // TODO: make a full coverage test for validating content instead of using temp data
    if (subfolder === 'azimuth') {
        const contentResult = await loadContent({
            dirPath: dirPath,
            config: result.config,
            skipUnmodeledContent: false
        });
        expect(contentResult.errors).toHaveLength(0);
    }
});

test('modelName is returned in metadata of invalid objects', async () => {
    const dirPath = path.join(__dirname, `./data/content-with-errors`);
    const result = await loadConfig({ dirPath: dirPath });
    expect(result.errors).toHaveLength(0);

    const contentResult = await loadContent({
        dirPath: dirPath,
        config: result.config,
        skipUnmodeledContent: false
    });

    const commonErrorFields = {
        type: 'string.base',
        modelName: 'config',
        filePath: 'data/config.json'
    };

    const errors = contentResult.errors.map((error) => _.pick(error, ['message', 'type', 'modelName', 'filePath', 'fieldPath']));

    expect(errors).toHaveLength(11);
    expect(errors).toMatchObject([
        { ...commonErrorFields, fieldPath: ['title'] },
        { ...commonErrorFields, fieldPath: ['action', 'label'] },
        { ...commonErrorFields, fieldPath: ['action', 'icon', 'icon_type'] },
        { ...commonErrorFields, fieldPath: ['action', 'icon', 'icon_color'] },
        { ...commonErrorFields, fieldPath: ['actions', 0, 'label'] },
        { ...commonErrorFields, fieldPath: ['actions', 0, 'icon', 'icon_type'] },
        { ...commonErrorFields, fieldPath: ['actions', 1, 'label'] },
        { ...commonErrorFields, fieldPath: ['actions', 1, 'icon', 'icon_type'] },
        { ...commonErrorFields, fieldPath: ['section', 'title'] },
        { ...commonErrorFields, fieldPath: ['section', 'action', 'label'] },
        { ...commonErrorFields, fieldPath: ['section', 'action', 'icon', 'icon_type'] }
    ]);
    expect(contentResult.contentItems).toMatchObject([
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
    ]);
});

test('invalid models should not affect loading and matching content to valid models', async () => {
    const dirPath = path.join(__dirname, 'data/schema-with-errors');
    const result = await loadConfig({ dirPath: dirPath });

    const contentResult = await loadContent({
        dirPath: dirPath,
        config: result.config,
        skipUnmodeledContent: false
    });

    const errors = contentResult.errors.map((error) => _.pick(error, ['message', 'filePath']));

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
