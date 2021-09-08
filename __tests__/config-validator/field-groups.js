const { describe, expect, test } = require('@jest/globals');

const { expectModelPassingValidation, expectModelValidationResultToMatchAllErrors } = require('../test-utils');

describe('model "fieldGroups" property', () => {
    test('should fail validation if field group item is not an object', () => {
        expectModelValidationResultToMatchAllErrors(
            {
                fieldGroups: ['settings']
            },
            [
                {
                    type: 'object.base',
                    fieldPath: ['models', 'test_model', 'fieldGroups', 0],
                    message: 'models.test_model.fieldGroups[0] must be of type object'
                }
            ]
        );
    });

    test('should fail validation if field group item does not have the "name" property', () => {
        expectModelValidationResultToMatchAllErrors(
            {
                fieldGroups: [{ label: 'Settings' }]
            },
            [
                {
                    type: 'any.required',
                    fieldPath: ['models', 'test_model', 'fieldGroups', 0, 'name'],
                    message: 'models.test_model.fieldGroups[0].name is required'
                }
            ]
        );
    });

    test('should fail validation if field group item does not have the "label" property', () => {
        expectModelValidationResultToMatchAllErrors(
            {
                fieldGroups: [{ name: 'settings' }]
            },
            [
                {
                    type: 'any.required',
                    fieldPath: ['models', 'test_model', 'fieldGroups', 0, 'label'],
                    message: 'models.test_model.fieldGroups[0].label is required'
                }
            ]
        );
    });

    test('should fail validation if field group items have duplicate group names', () => {
        expectModelValidationResultToMatchAllErrors(
            {
                fieldGroups: [
                    { name: 'settings', label: 'Settings' },
                    { name: 'settings', label: 'Settings' }
                ]
            },
            [
                {
                    type: 'array.unique',
                    fieldPath: ['models', 'test_model', 'fieldGroups', 1],
                    message: 'models.test_model.fieldGroups[1] contains a duplicate group name "settings"'
                }
            ]
        );
    });

    test('should pass validation if field group items are valid', () => {
        expectModelPassingValidation({
            fieldGroups: [
                { name: 'settings', label: 'Settings' },
                { name: 'style', label: 'Style' }
            ]
        });
    });

    test('should fail the validation if model field reference invalid group name', () => {
        expectModelValidationResultToMatchAllErrors(
            {
                fieldGroups: [{ name: 'settings', label: 'Settings' }],
                fields: [
                    { type: 'string', name: 'title' },
                    { type: 'string', name: 'color', group: 'style' }
                ]
            },
            [
                {
                    type: 'any.only',
                    fieldPath: ['models', 'test_model', 'fields', 1, 'group'],
                    message: 'models.test_model.fields[1].group must be one of model field groups, got "style"'
                }
            ]
        );
    });

    test('should pass the validation if model fields reference valid group name', () => {
        expectModelPassingValidation({
            fieldGroups: [{ name: 'style', label: 'Style' }],
            fields: [
                { type: 'string', name: 'title' },
                { type: 'string', name: 'color', group: 'style' }
            ]
        });
    });

    test('should fail the validation if fields of nested "object" field reference invalid group name', () => {
        expectModelValidationResultToMatchAllErrors(
            {
                fields: [
                    {
                        type: 'object',
                        name: 'nestedObject',
                        fieldGroups: [{ name: 'settings', label: 'Settings' }],
                        fields: [
                            { type: 'string', name: 'title' },
                            { type: 'string', name: 'color', group: 'style' }
                        ]
                    }
                ]
            },
            [
                {
                    type: 'any.only',
                    fieldPath: ['models', 'test_model', 'fields', 0, 'fields', 1, 'group'],
                    message: 'models.test_model.fields[0].fields[1].group must be one of model field groups, got "style"'
                }
            ]
        );
    });

    test('should pass the validation if fields of nested "object" field reference valid group name', () => {
        expectModelPassingValidation({
            fields: [
                {
                    type: 'object',
                    name: 'nestedObject',
                    fieldGroups: [{ name: 'style', label: 'Style' }],
                    fields: [
                        { type: 'string', name: 'title' },
                        { type: 'string', name: 'color', group: 'style' }
                    ]
                }
            ]
        });
    });

    test('should fail the validation if fields of nested "list of object" field reference invalid group name', () => {
        expectModelValidationResultToMatchAllErrors(
            {
                fields: [
                    {
                        type: 'list',
                        name: 'nestedObjectList',
                        items: {
                            type: 'object',
                            fieldGroups: [{ name: 'settings', label: 'Settings' }],
                            fields: [
                                { type: 'string', name: 'title' },
                                { type: 'string', name: 'color', group: 'style' }
                            ]
                        }
                    }
                ]
            },
            [
                {
                    type: 'any.only',
                    fieldPath: ['models', 'test_model', 'fields', 0, 'items', 'fields', 1, 'group'],
                    message: 'models.test_model.fields[0].items.fields[1].group must be one of model field groups, got "style"'
                }
            ]
        );
    });

    test('should pass the validation if fields of nested "list of object" field reference valid group name', () => {
        expectModelPassingValidation({
            fields: [
                {
                    type: 'list',
                    name: 'nestedObjectList',
                    items: {
                        type: 'object',
                        fieldGroups: [{ name: 'style', label: 'Style' }],
                        fields: [
                            { type: 'string', name: 'title' },
                            { type: 'string', name: 'color', group: 'style' }
                        ]
                    }
                }
            ]
        });
    });
});
