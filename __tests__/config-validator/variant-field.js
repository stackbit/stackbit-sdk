const { describe, expect, test } = require('@jest/globals');

const { expectModelPassingValidation, expectModelValidationResultToMatchAllErrors } = require('../test-utils');

describe('model "variantField" value', () => {
    test('should fail validation when defined in a model without fields', () => {
        expectModelValidationResultToMatchAllErrors(
            {
                variantField: 'illegalField',
                fields: []
            },
            [
                {
                    type: 'variantField.not.found',
                    fieldPath: ['models', 'test_model', 'variantField'],
                    message: 'models.test_model.variantField must be one of model field names, got "illegalField"'
                }
            ]
        );
    });

    test('should fail validation when referencing non existing field', () => {
        expectModelValidationResultToMatchAllErrors(
            {
                variantField: 'illegalField',
                fields: [{ type: 'string', name: 'someField' }]
            },
            [
                {
                    type: 'variantField.not.found',
                    fieldPath: ['models', 'test_model', 'variantField'],
                    message: 'models.test_model.variantField must be one of model field names, got "illegalField"'
                }
            ]
        );
    });

    test('should fail validation when referencing field having a type other than "enum"', () => {
        expectModelValidationResultToMatchAllErrors(
            {
                variantField: 'stringField',
                fields: [{ type: 'string', name: 'stringField' }]
            },
            [
                {
                    type: 'variantField.not.enum',
                    fieldPath: ['models', 'test_model', 'variantField'],
                    message: 'models.test_model.variantField should reference "enum" field, got "stringField" field of type "string"'
                }
            ]
        );
    });

    test('should pass validation when referencing an existing enum field', () => {
        expectModelPassingValidation({
            variantField: 'someField',
            fields: [{ type: 'enum', name: 'someField', options: [] }]
        });
    });

    test('should fail validation when defined in a nested "object" field without fields', () => {
        expectModelValidationResultToMatchAllErrors(
            {
                fields: [
                    {
                        type: 'object',
                        name: 'header',
                        variantField: 'title',
                        fields: []
                    }
                ]
            },
            [{ type: 'variantField.not.found', fieldPath: ['models', 'test_model', 'fields', 0, 'variantField'] }]
        );
    });

    test('should fail validation when referencing non existing field of a nested "object" field', () => {
        expectModelValidationResultToMatchAllErrors(
            {
                fields: [
                    {
                        type: 'object',
                        name: 'header',
                        variantField: 'illegalField',
                        fields: [{ type: 'string', name: 'title' }]
                    }
                ]
            },
            [
                {
                    type: 'variantField.not.found',
                    fieldPath: ['models', 'test_model', 'fields', 0, 'variantField'],
                    message: 'models.test_model.fields[0].variantField must be one of model field names, got "illegalField"'
                }
            ]
        );
    });

    test('should fail validation when referencing field of a nested "object" field having type other than "enum"', () => {
        expectModelValidationResultToMatchAllErrors(
            {
                fields: [
                    {
                        type: 'object',
                        name: 'header',
                        variantField: 'stringField',
                        fields: [{ type: 'string', name: 'stringField' }]
                    }
                ]
            },
            [
                {
                    type: 'variantField.not.enum',
                    fieldPath: ['models', 'test_model', 'fields', 0, 'variantField'],
                    message: 'models.test_model.fields[0].variantField should reference "enum" field, got "stringField" field of type "string"'
                }
            ]
        );
    });

    test('should pass validation when referencing an exiting "enum" field of a nested "object" field', () => {
        expectModelPassingValidation({
            fields: [
                {
                    type: 'object',
                    name: 'header',
                    variantField: 'enumField',
                    fields: [{ type: 'enum', name: 'enumField', options: [] }]
                }
            ]
        });
    });
});
