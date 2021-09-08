const _ = require('lodash');
const { describe, test } = require('@jest/globals');

const {
    expectPassingValidation,
    expectModelPassingValidation,
    expectValidationResultToMatchAllErrors,
    expectModelValidationResultToMatchAllErrors
} = require('../test-utils');

describe('field naming rules', () => {
    test('model fields with non unique names should fail validation', () => {
        expectModelValidationResultToMatchAllErrors(
            {
                fields: [
                    { type: 'string', name: 'label', label: 'Label' },
                    { type: 'string', name: 'label', label: 'URL' }
                ]
            },
            [
                {
                    type: 'field.name.unique',
                    fieldPath: ['models', 'test_model', 'fields', 1],
                    message: 'models.test_model.fields[1] contains a duplicate field name "label"'
                }
            ]
        );
    });

    test('model fields with unique names should pass validation', () => {
        expectModelPassingValidation({
            fields: [
                { type: 'string', name: 'label', label: 'Label' },
                { type: 'string', name: 'url', label: 'URL' }
            ]
        });
    });

    test('nested objects with fields with non unique names should fail validation', () => {
        expectModelValidationResultToMatchAllErrors(
            {
                fields: [
                    {
                        type: 'object',
                        name: 'nested_object',
                        fields: [
                            { type: 'string', name: 'label', label: 'Label' },
                            { type: 'string', name: 'label', label: 'URL' }
                        ]
                    }
                ]
            },
            [
                {
                    type: 'field.name.unique',
                    fieldPath: ['models', 'test_model', 'fields', 0, 'fields', 1],
                    message: 'models.test_model.fields[0].fields[1] contains a duplicate field name "label"'
                }
            ]
        );
    });

    test('nested objects with fields with unique names should pass validation', () => {
        expectModelPassingValidation({
            fields: [
                {
                    type: 'object',
                    name: 'nested_object',
                    fields: [
                        { type: 'string', name: 'label', label: 'Label' },
                        { type: 'string', name: 'url', label: 'URL' }
                    ]
                }
            ]
        });
    });

    test('nested list of objects with fields with non unique names should fail validation', () => {
        expectModelValidationResultToMatchAllErrors(
            {
                fields: [
                    {
                        type: 'list',
                        name: 'nested_object_list',
                        items: {
                            type: 'object',
                            fields: [
                                { type: 'string', name: 'label', label: 'Label' },
                                { type: 'string', name: 'label', label: 'URL' }
                            ]
                        }
                    }
                ]
            },
            [
                {
                    type: 'field.name.unique',
                    fieldPath: ['models', 'test_model', 'fields', 0, 'items', 'fields', 1],
                    message: 'models.test_model.fields[0].items.fields[1] contains a duplicate field name "label"'
                }
            ]
        );
    });

    test('nested list of objects with fields with unique names should pass validation', () => {
        expectModelPassingValidation({
            fields: [
                {
                    type: 'list',
                    name: 'nested_object_list',
                    items: {
                        type: 'object',
                        fields: [
                            { type: 'string', name: 'label', label: 'Label' },
                            { type: 'string', name: 'url', label: 'URL' }
                        ]
                    }
                }
            ]
        });
    });

    test('model field names must adhere naming rules', () => {
        expectModelValidationResultToMatchAllErrors(
            {
                fields: [{ type: 'string', name: '_label', label: 'Label' }]
            },
            [
                {
                    type: 'string.pattern.base',
                    fieldPath: ['models', 'test_model', 'fields', 0, 'name'],
                    message:
                        'Invalid field name "_label" at "models.test_model.fields[0].name". A field name must contain only alphanumeric characters, hyphens and underscores, must start and end with an alphanumeric character.'
                }
            ]
        );
    });
});

describe('number field', () => {
    test.each(['string', 'text', 'markdown', 'boolean'])('non "number" fields with "subtype" property should fail validation', (fieldType) => {
        expectModelValidationResultToMatchAllErrors(
            {
                fields: [
                    {
                        type: fieldType,
                        name: 'style',
                        subtype: 'float'
                    }
                ]
            },
            [
                {
                    type: 'object.unknown',
                    fieldPath: ['models', 'test_model', 'fields', 0, 'subtype'],
                    message: 'models.test_model.fields[0].subtype is not allowed'
                }
            ]
        );
    });

    test('number field with subtype other than "int" or "float" should fail validation', () => {
        expectModelValidationResultToMatchAllErrors(
            {
                fields: [
                    {
                        type: 'number',
                        name: 'style',
                        subtype: 'invalidSubtype'
                    }
                ]
            },
            [
                {
                    type: 'any.only',
                    fieldPath: ['models', 'test_model', 'fields', 0, 'subtype'],
                    message: 'models.test_model.fields[0].subtype must be one of [int, float]'
                }
            ]
        );
    });

    test.each(['int', 'float'])('number field with subtype "int" or "float" should pass validation', (subtype) => {
        expectModelPassingValidation({
            fields: [
                {
                    type: 'number',
                    name: 'style',
                    subtype: subtype
                }
            ]
        });
    });
});

describe('object field', () => {
    test('"object" field without "fields" array should fail validation', () => {
        expectModelValidationResultToMatchAllErrors(
            {
                fields: [
                    {
                        type: 'object',
                        name: 'header'
                    }
                ]
            },
            [
                {
                    type: 'any.required',
                    fieldPath: ['models', 'test_model', 'fields', 0, 'fields'],
                    message: 'models.test_model.fields[0].fields is required'
                }
            ]
        );
    });

    test('"object" field with empty "fields" array should pass validation', () => {
        expectModelPassingValidation({
            fields: [
                {
                    type: 'object',
                    name: 'header',
                    fields: []
                }
            ]
        });
    });

    test.each(['string', 'text', 'markdown', 'number', 'boolean'])('non object fields with "fields" property should fail validation', (fieldType) => {
        expectModelValidationResultToMatchAllErrors(
            {
                fields: [
                    {
                        type: fieldType,
                        name: 'style',
                        fields: []
                    }
                ]
            },
            [
                {
                    type: 'object.unknown',
                    fieldPath: ['models', 'test_model', 'fields', 0, 'fields'],
                    message: 'models.test_model.fields[0].fields is not allowed'
                }
            ]
        );
    });

    test('"object" field with nested "object" field should pass validation', () => {
        expectModelPassingValidation({
            fields: [
                {
                    type: 'object',
                    name: 'header',
                    fields: [
                        {
                            type: 'object',
                            name: 'subheader',
                            fields: [{ type: 'string', name: 'title' }]
                        }
                    ]
                }
            ]
        });
    });

    test('"object" field with nested "object" field with missing required fields should fail validation', () => {
        expectModelValidationResultToMatchAllErrors(
            {
                fields: [
                    {
                        type: 'object',
                        name: 'header',
                        fields: [
                            {
                                type: 'object',
                                name: 'subheader',
                                fields: [{ type: 'string' }]
                            }
                        ]
                    }
                ]
            },
            [
                {
                    type: 'any.required',
                    fieldPath: ['models', 'test_model', 'fields', 0, 'fields', 0, 'fields', 0, 'name'],
                    message: 'models.test_model.fields[0].fields[0].fields[0].name is required'
                }
            ]
        );
    });

    test('"object" field with nested "list" field with invalid "items" field should fail validation', () => {
        expectModelValidationResultToMatchAllErrors(
            {
                fields: [
                    {
                        type: 'object',
                        name: 'header',
                        fields: [
                            {
                                type: 'list',
                                name: 'links',
                                items: 'illegal'
                            }
                        ]
                    }
                ]
            },
            [
                {
                    type: 'object.base',
                    fieldPath: ['models', 'test_model', 'fields', 0, 'fields', 0, 'items'],
                    message: 'models.test_model.fields[0].fields[0].items must be of type object'
                }
            ]
        );
    });
});

describe('list field', () => {
    test.each(['string', 'text', 'markdown', 'number', 'boolean'])('non "list" fields with "items" property should fail validation', (fieldType) => {
        expectModelValidationResultToMatchAllErrors(
            {
                fields: [
                    {
                        type: fieldType,
                        name: 'style',
                        items: {}
                    }
                ]
            },
            [
                {
                    type: 'object.unknown',
                    fieldPath: ['models', 'test_model', 'fields', 0, 'items'],
                    message: 'models.test_model.fields[0].items is not allowed'
                }
            ]
        );
    });

    test('"list" field with with illegal items should fail validation', () => {
        expectModelValidationResultToMatchAllErrors(
            {
                fields: [
                    {
                        type: 'list',
                        name: 'links',
                        items: {
                            type: 'string',
                            name: 'title'
                        }
                    }
                ]
            },
            [
                {
                    type: 'object.unknown',
                    fieldPath: ['models', 'test_model', 'fields', 0, 'items', 'name'],
                    message: 'models.test_model.fields[0].items.name is not allowed'
                }
            ]
        );
    });

    test('"list" field with nested object with field without a name should fail validation', () => {
        expectModelValidationResultToMatchAllErrors(
            {
                fields: [
                    {
                        type: 'list',
                        name: 'links',
                        items: {
                            type: 'object',
                            fields: [{ type: 'string' }]
                        }
                    }
                ]
            },
            [
                {
                    type: 'any.required',
                    fieldPath: ['models', 'test_model', 'fields', 0, 'items', 'fields', 0, 'name'],
                    message: 'models.test_model.fields[0].items.fields[0].name is required'
                }
            ]
        );
    });

    test('"list" field with nested object with field with an illegal name should fail validation', () => {
        expectModelValidationResultToMatchAllErrors(
            {
                fields: [
                    {
                        type: 'list',
                        name: 'links',
                        items: {
                            type: 'object',
                            fields: [
                                {
                                    type: 'string',
                                    name: '_legal_name'
                                }
                            ]
                        }
                    }
                ]
            },
            [
                {
                    type: 'string.pattern.base',
                    fieldPath: ['models', 'test_model', 'fields', 0, 'items', 'fields', 0, 'name'],
                    message:
                        'Invalid field name "_legal_name" at "models.test_model.fields[0].items.fields[0].name". A field name must contain only alphanumeric characters, hyphens and underscores, must start and end with an alphanumeric character.'
                }
            ]
        );
    });
});

describe('model and reference fields', () => {
    test.each(['string', 'text', 'markdown', 'number', 'boolean'])(
        'non "model" and non "reference" field types with "models" property should fail validation',
        (fieldType) => {
            expectModelValidationResultToMatchAllErrors(
                {
                    fields: [
                        {
                            type: fieldType,
                            name: 'style',
                            models: []
                        }
                    ]
                },
                [
                    {
                        type: 'object.unknown',
                        fieldPath: ['models', 'test_model', 'fields', 0, 'models'],
                        message: 'models.test_model.fields[0].models is not allowed'
                    }
                ]
            );
        }
    );

    test.each(['model', 'reference'])('"model" and "reference" fields without "models" property should fail validation', (fieldType) => {
        expectModelValidationResultToMatchAllErrors(
            {
                fields: [
                    {
                        type: fieldType,
                        name: 'style'
                    }
                ]
            },
            [
                {
                    type: 'any.required',
                    fieldPath: ['models', 'test_model', 'fields', 0, 'models'],
                    message: 'models.test_model.fields[0].models is required'
                }
            ]
        );
    });

    test.each(['model', 'reference'])('"model" and "reference" fields with "models" property should pass validation', (fieldType) => {
        expectModelPassingValidation({
            fields: [
                {
                    type: fieldType,
                    name: 'style',
                    models: []
                }
            ]
        });
    });

    test('"model" field referencing non existing "models" should fail validation', () => {
        expectModelValidationResultToMatchAllErrors(
            {
                fields: [
                    {
                        type: 'model',
                        name: 'style',
                        models: ['no_such_model']
                    }
                ]
            },
            [
                {
                    type: 'model.name.of.object.models',
                    fieldPath: ['models', 'test_model', 'fields', 0, 'models', 0],
                    message: 'models.test_model.fields[0].models[0] must reference the name of an existing model of type "object", got "no_such_model"'
                }
            ]
        );
    });

    test('"reference" field referencing non existing "models" should fail validation', () => {
        expectModelValidationResultToMatchAllErrors(
            {
                fields: [
                    {
                        type: 'reference',
                        name: 'style',
                        models: ['no_such_model']
                    }
                ]
            },
            [
                {
                    type: 'model.name.of.document.models',
                    fieldPath: ['models', 'test_model', 'fields', 0, 'models', 0],
                    message: 'models.test_model.fields[0].models[0] must reference the name of an existing model of type "page" or "data", got "no_such_model"'
                }
            ]
        );
    });

    test('"model" field referencing non "object" model should fail validation', () => {
        expectValidationResultToMatchAllErrors(
            {
                models: {
                    test_model: {
                        type: 'object',
                        label: 'Button',
                        fields: [
                            {
                                type: 'model',
                                name: 'style',
                                models: ['post']
                            }
                        ]
                    },
                    post: {
                        type: 'page',
                        label: 'Post'
                    }
                }
            },
            [
                {
                    type: 'model.name.of.object.models',
                    fieldPath: ['models', 'test_model', 'fields', 0, 'models', 0],
                    message: 'models.test_model.fields[0].models[0] must reference the name of an existing model of type "object", got "post"'
                }
            ]
        );
    });

    test('"reference" field referencing non "data" or "page" models should fail validation', () => {
        expectValidationResultToMatchAllErrors(
            {
                models: {
                    test_model: {
                        type: 'object',
                        label: 'Button',
                        fields: [
                            {
                                type: 'reference',
                                name: 'style',
                                models: ['style']
                            }
                        ]
                    },
                    style: {
                        type: 'object',
                        label: 'Post'
                    }
                }
            },
            [
                {
                    type: 'model.name.of.document.models',
                    fieldPath: ['models', 'test_model', 'fields', 0, 'models', 0],
                    message: 'models.test_model.fields[0].models[0] must reference the name of an existing model of type "page" or "data", got "style"'
                }
            ]
        );
    });

    test('"model" fields referencing "object" model should pass validation', () => {
        expectPassingValidation({
            models: {
                test_model: {
                    type: 'object',
                    label: 'Button',
                    fields: [
                        {
                            type: 'model',
                            name: 'style',
                            models: ['style']
                        }
                    ]
                },
                style: {
                    type: 'object',
                    label: 'style'
                }
            }
        });
    });

    test('"reference" fields referencing "data" or "page" models should pass validation', () => {
        expectPassingValidation({
            models: {
                test_model: {
                    type: 'object',
                    label: 'Button',
                    fields: [
                        {
                            type: 'reference',
                            name: 'author',
                            models: ['author']
                        },
                        {
                            type: 'reference',
                            name: 'post',
                            models: ['post']
                        }
                    ]
                },
                author: {
                    type: 'data',
                    label: 'Author'
                },
                post: {
                    type: 'page',
                    label: 'Post'
                }
            }
        });
    });
});
