const path = require('path');
const _ = require('lodash');
const { describe, test, expect } = require('@jest/globals');

const { expectPassingValidation, expectValidationResultToMatchAllErrors } = require('../test-utils');
const { loadConfig } = require('../../src/config/config-loader');

describe('model "groups" property', () => {
    test('should fail validation when group has mixed models types', () => {
        expectValidationResultToMatchAllErrors(
            {
                models: {
                    object_1: { type: 'object', label: 'Object 1', groups: ['group_1'] },
                    object_2: { type: 'object', label: 'Object 2', groups: ['group_2'] },
                    object_3: { type: 'object', label: 'Object 2', groups: ['group_3'] },
                    page_1: { type: 'page', label: 'Page 1', groups: ['group_1'] },
                    page_2: { type: 'page', label: 'Page 2', groups: ['group_2'] },
                    page_3: { type: 'page', label: 'Page 3', groups: ['group_4'] },
                    data_1: { type: 'data', label: 'Data 1', groups: ['group_1'] },
                    data_2: { type: 'data', label: 'Data 2', groups: ['group_4'] }
                }
            },
            [
                {
                    type: 'group.models.incompatible',
                    fieldPath: ['models'],
                    message: expect.stringContaining(
                        'Model groups must include models of the same type. ' +
                            'The following groups have incompatible models: ' +
                            'group "group_1" include models of type "object" (object_1) and objects of type "page" or "data" (page_1, data_1), ' +
                            'group "group_2" include models of type "object" (object_2) and objects of type "page" or "data" (page_2)'
                    )
                }
            ]
        );
    });

    test('should fail validation when "model" field references non existing group', () => {
        expectValidationResultToMatchAllErrors(
            {
                models: {
                    object_1: {
                        type: 'object',
                        label: 'Object 1',
                        fields: [
                            {
                                type: 'model',
                                name: 'model_field',
                                groups: ['group_1', 'group_2']
                            }
                        ]
                    },
                    object_2: { type: 'object', label: 'Object 2', groups: ['group_1'] }
                }
            },
            [
                {
                    type: 'group.not.found',
                    fieldPath: ['models', 'object_1', 'fields', 0, 'groups', 1],
                    message: expect.stringContaining(
                        'models.object_1.fields[0].groups[1] of a "model" field must reference the name of an existing group, got "group_2"'
                    )
                }
            ]
        );
    });

    test('should fail validation when list of "model" field references non existing group', () => {
        expectValidationResultToMatchAllErrors(
            {
                models: {
                    object_1: {
                        type: 'object',
                        label: 'Object 1',
                        fields: [
                            {
                                type: 'list',
                                name: 'model_list_field',
                                items: {
                                    type: 'model',
                                    groups: ['group_1', 'group_2']
                                }
                            }
                        ]
                    },
                    object_2: { type: 'object', label: 'Object 2', groups: ['group_1'] }
                }
            },
            [
                {
                    type: 'group.not.found',
                    fieldPath: ['models', 'object_1', 'fields', 0, 'items', 'groups', 1],
                    message: expect.stringContaining(
                        'models.object_1.fields[0].items.groups[1] of a "model" field must reference the name of an existing group, got "group_2"'
                    )
                }
            ]
        );
    });

    test('should fail validation when "reference" field references non existing group', () => {
        expectValidationResultToMatchAllErrors(
            {
                models: {
                    object_1: {
                        type: 'object',
                        label: 'Object 1',
                        fields: [
                            {
                                type: 'reference',
                                name: 'reference_field',
                                groups: ['group_1', 'group_2']
                            }
                        ]
                    },
                    data_1: { type: 'data', label: 'Data 1', groups: ['group_1'] }
                }
            },
            [
                {
                    type: 'group.not.found',
                    fieldPath: ['models', 'object_1', 'fields', 0, 'groups', 1],
                    message: expect.stringContaining(
                        'models.object_1.fields[0].groups[1] of a "reference" field must reference the name of an existing group, got "group_2"'
                    )
                }
            ]
        );
    });

    test('should fail validation when list of "reference" field references non existing group', () => {
        expectValidationResultToMatchAllErrors(
            {
                models: {
                    object_1: {
                        type: 'object',
                        label: 'Object 1',
                        fields: [
                            {
                                type: 'list',
                                name: 'reference_list_field',
                                items: {
                                    type: 'reference',
                                    groups: ['group_1', 'group_2']
                                }
                            }
                        ]
                    },
                    data_1: { type: 'data', label: 'Data 1', groups: ['group_1'] }
                }
            },
            [
                {
                    type: 'group.not.found',
                    fieldPath: ['models', 'object_1', 'fields', 0, 'items', 'groups', 1],
                    message: expect.stringContaining(
                        'models.object_1.fields[0].items.groups[1] of a "reference" field must reference the name of an existing group, got "group_2"'
                    )
                }
            ]
        );
    });

    test('should fail validation when "model" field references group with "page" or "data" models', () => {
        expectValidationResultToMatchAllErrors(
            {
                models: {
                    object_1: {
                        type: 'object',
                        label: 'Object 1',
                        fields: [
                            {
                                type: 'model',
                                name: 'model_field',
                                groups: ['group_1', 'group_2']
                            }
                        ]
                    },
                    object_2: { type: 'object', label: 'Object 2', groups: ['group_1'] },
                    data_1: { type: 'data', label: 'Data 1', groups: ['group_2'] },
                    data_2: { type: 'data', label: 'Data 2', groups: ['group_2'] }
                }
            },
            [
                {
                    type: 'group.not.object.model',
                    fieldPath: ['models', 'object_1', 'fields', 0, 'groups', 1],
                    message: expect.stringContaining(
                        'models.object_1.fields[0].groups[1] of a "model" field must reference a group with only models of type "object", the "group_2" group includes models of type "page" or "data" (data_1, data_2)'
                    )
                }
            ]
        );
    });

    test('should fail validation when list of "model" field references group with "page" or "data" models', () => {
        expectValidationResultToMatchAllErrors(
            {
                models: {
                    object_1: {
                        type: 'object',
                        label: 'Object 1',
                        fields: [
                            {
                                type: 'list',
                                name: 'model_list_field',
                                items: {
                                    type: 'model',
                                    groups: ['group_1', 'group_2']
                                }
                            }
                        ]
                    },
                    object_2: { type: 'object', label: 'Object 2', groups: ['group_1'] },
                    data_1: { type: 'data', label: 'Data 1', groups: ['group_2'] },
                    data_2: { type: 'data', label: 'Data 2', groups: ['group_2'] }
                }
            },
            [
                {
                    type: 'group.not.object.model',
                    fieldPath: ['models', 'object_1', 'fields', 0, 'items', 'groups', 1],
                    message: expect.stringContaining(
                        'models.object_1.fields[0].items.groups[1] of a "model" field must reference a group with only models of type "object", the "group_2" group includes models of type "page" or "data" (data_1, data_2)'
                    )
                }
            ]
        );
    });

    test('should fail validation when "reference" field references group with "object" models', () => {
        expectValidationResultToMatchAllErrors(
            {
                models: {
                    object_1: {
                        type: 'object',
                        label: 'Object 1',
                        fields: [
                            {
                                type: 'reference',
                                name: 'reference_field',
                                groups: ['group_1', 'group_2']
                            }
                        ]
                    },
                    object_2: { type: 'object', label: 'Object 2', groups: ['group_1'] },
                    object_3: { type: 'object', label: 'Object 3', groups: ['group_1'] },
                    data_1: { type: 'data', label: 'Data 1', groups: ['group_2'] },
                    data_2: { type: 'data', label: 'Data 2', groups: ['group_2'] }
                }
            },
            [
                {
                    type: 'group.not.document.model',
                    fieldPath: ['models', 'object_1', 'fields', 0, 'groups', 0],
                    message: expect.stringContaining(
                        'models.object_1.fields[0].groups[0] of a "reference" field must reference a group with only models of type "page" or "data", the "group_1" group includes models of type "object" (object_2, object_3)'
                    )
                }
            ]
        );
    });

    test('should fail validation when list of "reference" field references group with "object" models', () => {
        expectValidationResultToMatchAllErrors(
            {
                models: {
                    object_1: {
                        type: 'object',
                        label: 'Object 1',
                        fields: [
                            {
                                type: 'list',
                                name: 'reference_list_field',
                                items: {
                                    type: 'reference',
                                    groups: ['group_1', 'group_2']
                                }
                            }
                        ]
                    },
                    object_2: { type: 'object', label: 'Object 2', groups: ['group_1'] },
                    object_3: { type: 'object', label: 'Object 3', groups: ['group_1'] },
                    data_1: { type: 'data', label: 'Data 1', groups: ['group_2'] },
                    data_2: { type: 'data', label: 'Data 2', groups: ['group_2'] }
                }
            },
            [
                {
                    type: 'group.not.document.model',
                    fieldPath: ['models', 'object_1', 'fields', 0, 'items', 'groups', 0],
                    message: expect.stringContaining(
                        'models.object_1.fields[0].items.groups[0] of a "reference" field must reference a group with only models of type "page" or "data", the "group_1" group includes models of type "object" (object_2, object_3)'
                    )
                }
            ]
        );
    });

    test('should convert to correct models even when "model" and "reference" fields referencing mixed groups', async() => {
        const azimuthStackbitYamlPath = path.join(__dirname, '../fixtures/model-groups/invalid');
        const result = await loadConfig({ dirPath: azimuthStackbitYamlPath });
        expect(result.valid).toBeFalsy();
        const object1Model = _.find(result.config.models, { name: 'object_1' });
        expect(object1Model).toMatchObject({
            name: 'object_1',
            fields: [
                {
                    name: 'model_field',
                    models: ['object_2', 'object_3']
                },
                {
                    name: 'reference_field',
                    models: ['page_1', 'data_1', 'page_2', 'data_2']
                },
                {
                    type: 'list',
                    name: 'model_list_field',
                    items: {
                        type: 'model',
                        models: ['object_2', 'object_3']
                    }
                },
                {
                    type: 'list',
                    name: 'reference_list_field',
                    items: {
                        type: 'reference',
                        models: ['page_1', 'data_1', 'page_2', 'data_2']
                    }
                }
            ]
        });
    });

    test('should pass validation when groups and field types match', () => {
        expectPassingValidation({
            models: {
                object_1: {
                    type: 'object',
                    label: 'Object 1',
                    fields: [
                        {
                            type: 'model',
                            name: 'model_field',
                            groups: ['group_1', 'group_2']
                        },
                        {
                            type: 'reference',
                            name: 'reference_field',
                            groups: ['group_3', 'group_4']
                        },
                        {
                            type: 'list',
                            name: 'model_list_field',
                            items: {
                                type: 'model',
                                groups: ['group_1', 'group_2']
                            }
                        },
                        {
                            type: 'list',
                            name: 'reference_list_field',
                            items: {
                                type: 'reference',
                                groups: ['group_3', 'group_4']
                            }
                        }
                    ]
                },
                object_2: { type: 'object', label: 'Object 2', groups: ['group_1'] },
                object_3: { type: 'object', label: 'Object 2', groups: ['group_1'] },
                object_4: { type: 'object', label: 'Object 4', groups: ['group_2'] },
                page_1: { type: 'page', label: 'Page 1', groups: ['group_3'] },
                page_2: { type: 'page', label: 'Page 2', groups: ['group_3'] },
                page_3: { type: 'page', label: 'Page 3', groups: ['group_3'] },
                data_1: { type: 'data', label: 'Data 1', groups: ['group_4'] },
                data_2: { type: 'data', label: 'Data 2', groups: ['group_4'] }
            }
        });
    });

    test('should convert to correct models list', async () => {
        const azimuthStackbitYamlPath = path.join(__dirname, '../fixtures/model-groups/valid');
        const result = await loadConfig({ dirPath: azimuthStackbitYamlPath });
        const object1Model = _.find(result.config.models, { name: 'object_1' });
        expect(object1Model).toMatchObject({
            name: 'object_1',
            fields: [
                {
                    name: 'model_field_cat_1',
                    models: ['object_2', 'object_3']
                },
                {
                    name: 'model_field_cat_2',
                    models: ['object_3', 'object_4']
                },
                {
                    name: 'model_field_cat_12',
                    models: ['object_2', 'object_3', 'object_4']
                },
                {
                    name: 'model_list_field',
                    items: {
                        models: ['object_2', 'object_3', 'object_4']
                    }
                },
                {
                    name: 'reference_field_cat_3',
                    models: ['page_1', 'page_2', 'data_1']
                },
                {
                    name: 'reference_field_cat_4',
                    models: ['page_2', 'data_1', 'data_2']
                },
                {
                    name: 'reference_field_cat_34',
                    models: ['page_1', 'page_2', 'data_1', 'data_2']
                },
                {
                    name: 'reference_list_field',
                    items: {
                        models: ['page_1', 'page_2', 'data_1', 'data_2']
                    }
                }
            ]
        });
        expect(result.valid).toBeTruthy();
    });
});
