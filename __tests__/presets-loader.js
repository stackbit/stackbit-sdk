const { describe, test, expect, beforeAll } = require('@jest/globals');
const _ = require('lodash');

const { loadConfigFromFixturePath } = require('./test-utils');

describe('presets loader - model-files', () => {
    let result;
    beforeAll(async () => {
        result = await loadConfigFromFixturePath('model-files');
    });

    test('basic loading', () => {
        expect(Object.keys(result.config.presets)).toMatchObject([
            '.stackbit/presets/model1.json:presets[0]',
            '.stackbit/presets/model1.json:presets[1]',
            '.stackbit/presets/model1_another.json:presets[0]',
            '.stackbit/presets/model1_another.json:presets[1]',
            '.stackbit/presets/model_stackbit_1.json:presets[0]',
            'node_modules/@stackbit/components/presets/model1.json:presets[0]',
            'node_modules/@stackbit/components/presets/model1.json:presets[1]'
        ]);
        expect(result.config.presets).toMatchObject(
            expect.objectContaining({
                '.stackbit/presets/model1.json:presets[0]': {
                    label: 'my preset 1',
                    thumbnail: '.stackbit/presets/path/to/preset-thumbnail1.png',
                    data: {
                        enum_field: 'thumbnail_1'
                    }
                }
            })
        );
    });

    test('inline model updating', () => {
        expect(_.find(result.config.models, (model) => model.name === 'model_1')).toMatchObject(
            expect.objectContaining({
                presets: [
                    '.stackbit/presets/model1.json:presets[0]',
                    '.stackbit/presets/model1.json:presets[1]',
                    '.stackbit/presets/model1_another.json:presets[0]',
                    '.stackbit/presets/model1_another.json:presets[1]',
                    'node_modules/@stackbit/components/presets/model1.json:presets[0]',
                    'node_modules/@stackbit/components/presets/model1.json:presets[1]'
                ]
            })
        );
    });

    test('thumbnail resolving', () => {
        expect(result.config.presets).toMatchObject(
            expect.objectContaining({
                '.stackbit/presets/model1.json:presets[0]': expect.objectContaining({
                    thumbnail: '.stackbit/presets/path/to/preset-thumbnail1.png'
                })
            })
        );
        expect(result.config.presets).toMatchObject(
            expect.objectContaining({
                '.stackbit/presets/model1.json:presets[1]': expect.objectContaining({
                    thumbnail: 'images/preset-thumbnail2.png'
                })
            })
        );
        expect(result.config.presets).toMatchObject(
            expect.objectContaining({
                'node_modules/@stackbit/components/presets/model1.json:presets[0]': expect.objectContaining({
                    thumbnail: 'node_modules/@stackbit/components/presets/path/to/ext-preset-thumbnail1.png'
                })
            })
        );
        expect(result.config.presets).toMatchObject(
            expect.objectContaining({
                'node_modules/@stackbit/components/presets/model1.json:presets[1]': expect.objectContaining({
                    thumbnail: 'node_modules/@stackbit/components/path/to/ext-preset-thumbnail2.png'
                })
            })
        );
    });

    test('presets only where needed', () => {
        expect(_.find(result.config.models, (model) => model.name === 'model_stackbit_2').presets).toBeFalsy();
    });

    test('report parsing error', () => {
        expect(result.errors.length).toEqual(1);
    });
});
