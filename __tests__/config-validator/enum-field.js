const { describe, test } = require('@jest/globals');

const { expectModelPassingValidation, expectModelValidationResultToMatchAllErrors } = require('../test-utils');

describe('enum field', () => {
    test.each(['string', 'text', 'markdown', 'number', 'boolean'])('%s field with "options" property should fail validation', (fieldType) => {
        expectModelValidationResultToMatchAllErrors(
            {
                fields: [
                    {
                        type: fieldType,
                        name: 'style',
                        options: ['primary', 'secondary']
                    }
                ]
            },
            [
                {
                    type: 'object.unknown',
                    fieldPath: ['models', 'test_model', 'fields', 0, 'options'],
                    message: 'models.test_model.fields[0].options is not allowed'
                }
            ]
        );
    });

    test('should fail validation when "options" property is missing', () => {
        expectModelValidationResultToMatchAllErrors(
            {
                fields: [
                    {
                        type: 'enum',
                        name: 'style'
                    }
                ]
            },
            [
                {
                    type: 'any.required',
                    fieldPath: ['models', 'test_model', 'fields', 0, 'options'],
                    message: 'models.test_model.fields[0].options is required'
                }
            ]
        );
    });

    test('should fail validation when "options" property is not an array', () => {
        expectModelValidationResultToMatchAllErrors(
            {
                fields: [
                    {
                        type: 'enum',
                        name: 'style',
                        options: 'primary'
                    }
                ]
            },
            [
                {
                    type: 'alternatives.types',
                    fieldPath: ['models', 'test_model', 'fields', 0, 'options'],
                    message:
                        'models.test_model.fields[0].options must be an array of strings or numbers, or an array of objects with label and value properties'
                }
            ]
        );
    });

    test('should pass validation when "options" is an array of strings', () => {
        expectModelPassingValidation({
            fields: [
                {
                    type: 'enum',
                    name: 'style',
                    options: ['primary', 'secondary']
                }
            ]
        });
    });

    test('should fail validation when "options" property is an array of objects without "value" property', () => {
        expectModelValidationResultToMatchAllErrors(
            {
                fields: [
                    {
                        type: 'enum',
                        name: 'style',
                        options: [{ label: 'Primary Color' }, { value: 'secondary', label: 'Secondary Color' }]
                    }
                ]
            },
            [
                {
                    type: 'alternatives.match',
                    fieldPath: ['models', 'test_model', 'fields', 0, 'options'],
                    message:
                        'models.test_model.fields[0].options must be an array of strings or numbers, or an array of objects with label and value properties'
                }
            ]
        );
    });

    test('should fail validation when "options" property is an array of objects without "label" property', () => {
        expectModelValidationResultToMatchAllErrors(
            {
                fields: [
                    {
                        type: 'enum',
                        name: 'style',
                        options: [{ value: 'primary' }, { value: 'secondary', label: 'Secondary Color' }]
                    }
                ]
            },
            [
                {
                    type: 'alternatives.match',
                    fieldPath: ['models', 'test_model', 'fields', 0, 'options'],
                    message:
                        'models.test_model.fields[0].options must be an array of strings or numbers, or an array of objects with label and value properties'
                }
            ]
        );
    });

    test('should pass validation when "options" property is an array of objects with "value" and "label" properties', () => {
        expectModelPassingValidation({
            fields: [
                {
                    type: 'enum',
                    name: 'style',
                    options: [
                        { value: 'primary', label: 'Primary Color' },
                        { value: 'secondary', label: 'Secondary Color' }
                    ]
                }
            ]
        });
    });

    test('should fail validation if "controlType" property is invalid', () => {
        expectModelValidationResultToMatchAllErrors(
            {
                fields: [
                    {
                        type: 'enum',
                        name: 'style',
                        controlType: 'invalid',
                        options: ['primary', 'secondary']
                    }
                ]
            },
            [
                {
                    type: 'any.only',
                    fieldPath: ['models', 'test_model', 'fields', 0, 'controlType'],
                    message: 'models.test_model.fields[0].controlType must be one of [dropdown, button-group, thumbnails, palette]'
                }
            ]
        );
    });

    test('should fail validation if "controlType" property is "thumbnails" and one of the "options" is not an object', () => {
        expectModelValidationResultToMatchAllErrors(
            {
                fields: [
                    {
                        type: 'enum',
                        name: 'style',
                        controlType: 'thumbnails',
                        options: ['primary', { value: 'secondary', label: 'Secondary Color', thumbnail: 'path' }]
                    }
                ]
            },
            [
                {
                    type: 'object.base',
                    fieldPath: ['models', 'test_model', 'fields', 0, 'options', 0],
                    message: 'models.test_model.fields[0].options[0] must be of type object'
                }
            ]
        );
    });

    test('should pass validation if "controlType" property is "thumbnails" and one of the "options" does not have a "thumbnail" property', () => {
        expectModelValidationResultToMatchAllErrors(
            {
                fields: [
                    {
                        type: 'enum',
                        name: 'style',
                        controlType: 'thumbnails',
                        options: [
                            { value: 'primary', label: 'Primary Color' },
                            { value: 'secondary', label: 'Secondary Color', thumbnail: 'path' }
                        ]
                    }
                ]
            },
            [
                {
                    type: 'any.required',
                    fieldPath: ['models', 'test_model', 'fields', 0, 'options', 0, 'thumbnail'],
                    message: 'models.test_model.fields[0].options[0].thumbnail is required'
                }
            ]
        );
    });

    test('should pass validation when "controlType" property is "thumbnails" and all "options" are valid', () => {
        expectModelPassingValidation({
            fields: [
                {
                    type: 'enum',
                    name: 'style',
                    controlType: 'thumbnails',
                    options: [
                        { value: 'primary', label: 'Primary Color', thumbnail: 'path' },
                        { value: 'secondary', label: 'Secondary Color', thumbnail: 'path' }
                    ]
                }
            ]
        });
    });

    test('should fail validation if "controlType" property is "palette" and one of the "options" is not an object', () => {
        expectModelValidationResultToMatchAllErrors(
            {
                fields: [
                    {
                        type: 'enum',
                        name: 'style',
                        controlType: 'palette',
                        options: ['primary', { value: 'secondary', label: 'Secondary Color' }]
                    }
                ]
            },
            [
                {
                    type: 'object.base',
                    fieldPath: ['models', 'test_model', 'fields', 0, 'options', 0],
                    message: 'models.test_model.fields[0].options[0] must be of type object'
                }
            ]
        );
    });

    test('should pass validation if "controlType" property is "palette" and all "options" are valid', () => {
        expectModelPassingValidation({
            fields: [
                {
                    type: 'enum',
                    name: 'style',
                    controlType: 'palette',
                    options: [
                        { value: 'primary', label: 'Primary Color' },
                        { value: 'secondary', label: 'Secondary Color', textColor: '#000000' },
                        { value: 'secondary', label: 'Secondary Color', textColor: '#000000', backgroundColor: '#ffffff' },
                        { value: 'secondary', label: 'Secondary Color', textColor: '#000000', backgroundColor: '#ffffff', borderColor: '#cccccc' }
                    ]
                }
            ]
        });
    });
});
