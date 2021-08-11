const path = require('path');
const { test, expect } = require('@jest/globals');
const _ = require('lodash');

const { loadConfig } = require('../src/config/config-loader');

const azimuthStackbitYamlPath = path.join(__dirname, 'fixtures/schema-with-errors');

test('normalized validation error should have normFieldPath with the normalized path', async () => {
    const result = await loadConfig({ dirPath: azimuthStackbitYamlPath });
    expect(result.valid).toBeFalsy();
    expect(_.every(_.take(result.config.models, 4), ['__metadata.invalid', true])).toBeTruthy();
    expect(result.errors).toMatchObject([
        {
            type: 'any.only',
            value: 'invalid_type',
            fieldPath: ['models', 'invalid_1', 'fields', 0, 'type'],
            normFieldPath: ['models', 0, 'fields', 0, 'type']
        },
        {
            type: 'any.required',
            value: undefined,
            fieldPath: ['models', 'invalid_1', 'fields', 1, 'name'],
            normFieldPath: ['models', 0, 'fields', 1, 'name']
        },
        {
            type: 'object.unknown',
            value: 'field',
            fieldPath: ['models', 'invalid_2', 'fields', 0, 'fields', 0, 'illegal'],
            normFieldPath: ['models', 1, 'fields', 0, 'fields', 0, 'illegal']
        },
        {
            type: 'object.unknown',
            value: 'field',
            fieldPath: ['models', 'invalid_2', 'fields', 1, 'items', 'fields', 0, 'illegal'],
            normFieldPath: ['models', 1, 'fields', 1, 'items', 'fields', 0, 'illegal']
        },
        {
            type: 'any.required',
            value: undefined,
            fieldPath: ['models', 'invalid_3', 'file'],
            normFieldPath: ['models', 2, 'file']
        },
        {
            type: 'string.empty',
            value: '',
            fieldPath: ['models', 'invalid_4', 'file'],
            normFieldPath: ['models', 3, 'file']
        }
    ]);
});
