const { describe, expect, test } = require('@jest/globals');

const { expectModelPassingValidation, expectModelValidationResultToMatchAllErrors } = require('../test-utils');

describe('model "labelField" value', () => {
    test('should fail validation when defined in a model without fields', () => {
        expectModelValidationResultToMatchAllErrors(
            {
                labelField: 'illegalField',
                fields: []
            },
            [
                {
                    type: 'labelField.not.found',
                    fieldPath: ['models', 'test_model', 'labelField'],
                    message: 'models.test_model.labelField must be one of model field names, got "illegalField"'
                }
            ]
        );
    });

    test('should fail validation when referencing non existing field', () => {
        expectModelValidationResultToMatchAllErrors(
            {
                labelField: 'illegalField',
                fields: [{ type: 'string', name: 'someField' }]
            },
            [
                {
                    type: 'labelField.not.found',
                    fieldPath: ['models', 'test_model', 'labelField'],
                    message: 'models.test_model.labelField must be one of model field names, got "illegalField"'
                }
            ]
        );
    });

    test('should fail validation when referencing field of type "object"', () => {
        expectModelValidationResultToMatchAllErrors(
            {
                labelField: 'object_field',
                fields: [{ type: 'object', name: 'object_field', fields: [] }]
            },
            [
                {
                    type: 'labelField.not.simple',
                    fieldPath: ['models', 'test_model', 'labelField'],
                    message: 'models.test_model.labelField can not reference complex field, got "object_field" field of type "object"'
                }
            ]
        );
    });

    test('should fail validation when referencing field of type "model"', () => {
        expectModelValidationResultToMatchAllErrors(
            {
                labelField: 'model_field',
                fields: [{ type: 'model', name: 'model_field', models: [] }]
            },
            [
                {
                    type: 'labelField.not.simple',
                    fieldPath: ['models', 'test_model', 'labelField'],
                    message: 'models.test_model.labelField can not reference complex field, got "model_field" field of type "model"'
                }
            ]
        );
    });

    test('should fail validation when referencing field of type "reference"', () => {
        expectModelValidationResultToMatchAllErrors(
            {
                labelField: 'reference_field',
                fields: [{ type: 'reference', name: 'reference_field', models: [] }]
            },
            [
                {
                    type: 'labelField.not.simple',
                    fieldPath: ['models', 'test_model', 'labelField'],
                    message: 'models.test_model.labelField can not reference complex field, got "reference_field" field of type "reference"'
                }
            ]
        );
    });

    test('should fail validation when referencing field of type "list"', () => {
        expectModelValidationResultToMatchAllErrors(
            {
                labelField: 'list_field',
                fields: [{ type: 'list', name: 'list_field', items: { type: 'string' } }]
            },
            [
                {
                    type: 'labelField.not.simple',
                    fieldPath: ['models', 'test_model', 'labelField'],
                    message: 'models.test_model.labelField can not reference complex field, got "list_field" field of type "list"'
                }
            ]
        );
    });

    test('should pass validation when referencing an existing field', () => {
        expectModelPassingValidation({
            labelField: 'string_field',
            fields: [{ type: 'string', name: 'string_field' }]
        });
    });

    test.each(['string', 'text', 'markdown', 'number', 'boolean'])('should fail validation on fields having type other than "object"', (fieldType) => {
        expectModelValidationResultToMatchAllErrors(
            {
                fields: [
                    {
                        type: fieldType,
                        name: 'style',
                        labelField: 'title'
                    }
                ]
            },
            [
                {
                    type: 'object.unknown',
                    fieldPath: ['models', 'test_model', 'fields', 0, 'labelField'],
                    message: 'models.test_model.fields[0].labelField is not allowed'
                }
            ]
        );
    });

    test('should fail validation when defined in a nested "object" field without fields', () => {
        expectModelValidationResultToMatchAllErrors(
            {
                fields: [
                    {
                        type: 'object',
                        name: 'header',
                        labelField: 'title',
                        fields: []
                    }
                ]
            },
            [{ type: 'labelField.not.found', fieldPath: ['models', 'test_model', 'fields', 0, 'labelField'] }]
        );
    });

    test('should fail validation when referencing non existing field of a nested "object" field', () => {
        expectModelValidationResultToMatchAllErrors(
            {
                fields: [
                    {
                        type: 'object',
                        name: 'header',
                        labelField: 'illegalField',
                        fields: [{ type: 'string', name: 'title' }]
                    }
                ]
            },
            [
                {
                    type: 'labelField.not.found',
                    fieldPath: ['models', 'test_model', 'fields', 0, 'labelField'],
                    message: 'models.test_model.fields[0].labelField must be one of model field names, got "illegalField"'
                }
            ]
        );
    });

    test('should pass validation when referencing an existing field of a nested "object" field', () => {
        expectModelPassingValidation({
            fields: [
                {
                    type: 'object',
                    name: 'header',
                    labelField: 'title',
                    fields: [{ type: 'string', name: 'title' }]
                }
            ]
        });
    });
});
