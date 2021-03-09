const path = require('path');
const { test, expect } = require('@jest/globals');

const { loadConfig } = require('../src/config/config-loader');

const azimuthStackbitYamlPath = path.join(__dirname, 'data/with-errors');

test('normalized validation error should have normFieldPath with the normalized path', async () => {
    const result = await loadConfig({ dirPath: azimuthStackbitYamlPath });
    expect(result.valid).toBeFalsy();
    expect(result.errors).toMatchObject([
        {
            type: 'any.only',
            value: 'invalid_type',
            fieldPath: ['models', 'page', 'fields', 0, 'type'],
            normFieldPath: ['models', 0, 'fields', 0, 'type']
        },
        {
            type: 'any.required',
            value: undefined,
            fieldPath: ['models', 'page', 'fields', 1, 'name'],
            normFieldPath: ['models', 0, 'fields', 1, 'name']
        },
        {
            type: 'object.unknown',
            value: 'field',
            fieldPath: ['models', 'post', 'fields', 0, 'fields', 0, 'illegal'],
            normFieldPath: ['models', 1, 'fields', 0, 'fields', 0, 'illegal']
        },
        {
            type: 'object.unknown',
            value: 'field',
            fieldPath: ['models', 'post', 'fields', 1, 'items', 'fields', 0, 'illegal'],
            normFieldPath: ['models', 1, 'fields', 1, 'items', 'fields', 0, 'illegal']
        }
    ]);
});
