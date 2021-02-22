const _ = require('lodash');
const { describe, test } = require('@jest/globals');

const {
    expectPassingValidation,
    expectValidationResultToMatchAllErrors
} = require('./test-utils');


function getMinimalModel(model) {
    return {
        models: {
            button: _.assign({
                type: 'object',
                label: 'Button'
            }, model)
        }
    };
}

function expectModelPassingValidation(model, options) {
    expectPassingValidation(
        getMinimalModel(model),
        options
    );
}

function expectModelValidationResultToMatchAllErrors(model, expectedErrors, options) {
    expectValidationResultToMatchAllErrors(
        getMinimalModel(model),
        expectedErrors,
        options
    );
}

describe('model fields base rules', () => {

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
                    path: ['models', 'button', 'fields', 1],
                    message: '"models.button.fields[1]" contains a duplicate field name "label"'
                }
            ]
        );
    });

    test('model fields with unique names should pass validation', () => {
        expectModelPassingValidation(
            {
                fields: [
                    { type: 'string', name: 'label', label: 'Label' },
                    { type: 'string', name: 'url', label: 'URL' }
                ]
            }
        );
    });

    test('model field names must adhere naming rules', () => {
        expectModelValidationResultToMatchAllErrors(
            {
                fields: [ { type: 'string', name: '_label', label: 'Label' } ]
            },
            [
                {
                    type: 'string.pattern.base',
                    path: ['models', 'button', 'fields', 0, 'name'],
                    message: 'Invalid field name "_label" at "models.button.fields[0].name". A field name must contain only alphanumeric characters, hyphens and underscores, must start and end with an alphanumeric character.'
                }
            ]
        );
    });

});

describe('enum field', () => {

    test.each([
        'string', 'text', 'markdown', 'number', 'boolean',
    ])('non enum fields with "options" property should fail validation', (fieldType) => {
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
            [{
                type: 'any.unknown',
                path: ['models', 'button', 'fields', 0, 'options'],
                message: 'models.button.fields[0].options is not allowed'
            }]
        );
    });

    test('enum field without "options" property should fail validation', () => {
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
                    path: ['models', 'button', 'fields', 0, 'options'],
                    message: 'models.button.fields[0].options is required'
                }
            ]
        );
    });

    test('non array "options" property of enum field should fail validation', () => {
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
                    path: ['models', 'button', 'fields', 0, 'options'],
                    message: 'models.button.fields[0].options must be an array of strings or numbers, or array of objects with label and value properties'
                }
            ]
        );
    });

    test('enum field with "options" array should pass validation', () => {
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

});

describe('number field', () => {

    test.each([
        'string', 'text', 'markdown', 'boolean'
    ])('non "number" fields with "subtype" property should fail validation', (fieldType) => {
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
            [{
                type: 'any.unknown',
                path: ['models', 'button', 'fields', 0, 'subtype'],
                message: 'models.button.fields[0].subtype is not allowed'
            }]
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
                    path: ['models', 'button', 'fields', 0, 'subtype'],
                    message: 'models.button.fields[0].subtype must be one of [int, float]'
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
                    path: ['models', 'button', 'fields', 0, 'fields'],
                    message: 'models.button.fields[0].fields is required'
                }
            ]
        );
    });

    test('"object" field with empty "fields" array should pass validation', () => {
        expectModelPassingValidation(
            {
                fields: [
                    {
                        type: 'object',
                        name: 'header',
                        fields: []
                    }
                ]
            }
        );
    });

    test.each([
        'string', 'text', 'markdown', 'number', 'boolean'
    ])('non object fields with "fields" property should fail validation', (fieldType) => {
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
            [{
                type: 'any.unknown',
                path: ['models', 'button', 'fields', 0, 'fields'],
                message: 'models.button.fields[0].fields is not allowed'
            }]
        );
    });

    test.each([
        'string', 'text', 'markdown', 'number', 'boolean'
    ])('non object fields with "labelField" property should fail validation', (fieldType) => {
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
            [{
                type: 'any.unknown',
                path: ['models', 'button', 'fields', 0, 'labelField'],
                message: 'models.button.fields[0].labelField is not allowed'
            }]
        );
    });

    test('"object" field with "labelField" property and without any fields should fail validation', () => {
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
            [
                { type: 'any.only', path: ['models', 'button', 'fields', 0, 'labelField'] }
            ]
        );
    });

    test('"object" field with "labelField" property referencing non existing fields should fail validation', () => {
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
                    type: 'any.only',
                    path: ['models', 'button', 'fields', 0, 'labelField'],
                    message: '"models.button.fields[0].labelField" must be one of model field names, got "illegalField"'
                }
            ]
        );
    });

    test('"object" field with "labelField" property referencing an existing field should pass validation', () => {
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
                                fields: [
                                    { type: 'string' }
                                ]
                            }
                        ]
                    }
                ]
            },
            [
                {
                    type: 'any.required',
                    path: ['models', 'button', 'fields', 0, 'fields', 0, 'fields', 0, 'name'],
                    message: 'models.button.fields[0].fields[0].fields[0].name is required'
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
                    path: ['models', 'button', 'fields', 0, 'fields', 0, 'items'],
                    message: 'models.button.fields[0].fields[0].items must be of type object'
                }
            ]
        );
    });
});

describe('list field', () => {

    test.each([
        'string', 'text', 'markdown', 'number', 'boolean'
    ])('non "list" fields with "items" property should fail validation', (fieldType) => {
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
            [{
                type: 'any.unknown',
                path: ['models', 'button', 'fields', 0, 'items'],
                message: 'models.button.fields[0].items is not allowed'
            }]
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
                    path: ['models', 'button', 'fields', 0, 'items', 'name'],
                    message: 'models.button.fields[0].items.name is not allowed'
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
                            fields: [
                                { type: 'string' }
                            ]
                        }
                    }
                ]
            },
            [
                {
                    type: 'any.required',
                    path: ['models', 'button', 'fields', 0, 'items', 'fields', 0, 'name'],
                    message: 'models.button.fields[0].items.fields[0].name is required'
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
                    path: ['models', 'button', 'fields', 0, 'items', 'fields', 0, 'name'],
                    message: 'Invalid field name "_legal_name" at "models.button.fields[0].items.fields[0].name". A field name must contain only alphanumeric characters, hyphens and underscores, must start and end with an alphanumeric character.'
                }
            ]
        );
    });

});

describe('model and reference fields', () => {

    test.each([
        'string', 'text', 'markdown', 'number', 'boolean'
    ])('non "model" and non "reference" field types with "models" property should fail validation', (fieldType) => {
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
            [{
                type: 'any.unknown',
                path: ['models', 'button', 'fields', 0, 'models'],
                message: 'models.button.fields[0].models is not allowed'
            }]
        );
    });

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
            [{
                type: 'any.required',
                path: ['models', 'button', 'fields', 0, 'models'],
                message: 'models.button.fields[0].models is required'
            }]
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
        expectValidationResultToMatchAllErrors(
            {
                models: {
                    button: {
                        type: 'object',
                        label: 'Button',
                        fields: [
                            {
                                type: 'model',
                                name: 'style',
                                models: ['no_such_model']
                            }
                        ]
                    }
                }
            },
            [{
                type: 'model.name.of.object.models',
                path: ['models', 'button', 'fields', 0, 'models', 0],
                message: '"models.button.fields[0].models[0]" must reference the name of an existing model of type "object", got "no_such_model"'
            }],
        );
    });

    test('"reference" field referencing non existing "models" should fail validation', () => {
        expectValidationResultToMatchAllErrors(
            {
                models: {
                    button: {
                        type: 'object',
                        label: 'Button',
                        fields: [
                            {
                                type: 'reference',
                                name: 'style',
                                models: ['no_such_model']
                            }
                        ]
                    }
                }
            },
            [{
                type: 'model.name.of.document.models',
                path: ['models', 'button', 'fields', 0, 'models', 0],
                message: '"models.button.fields[0].models[0]" must reference the name of an existing model of type "page" or "data", got "no_such_model"'
            }],
        );
    });

    test('"model" field referencing non "object" model should fail validation', () => {
        expectValidationResultToMatchAllErrors(
            {
                models: {
                    button: {
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
            [{
                type: 'model.name.of.object.models',
                path: ['models', 'button', 'fields', 0, 'models', 0],
                message: '"models.button.fields[0].models[0]" must reference the name of an existing model of type "object", got "post"'
            }],
        );
    });

    test('"reference" field referencing non "data" or "page" models should fail validation', () => {
        expectValidationResultToMatchAllErrors(
            {
                models: {
                    button: {
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
            [{
                type: 'model.name.of.document.models',
                path: ['models', 'button', 'fields', 0, 'models', 0],
                message: '"models.button.fields[0].models[0]" must reference the name of an existing model of type "page" or "data", got "style"'
            }],
        );
    });

    test('"model" fields referencing "object" model should pass validation', () => {
        expectPassingValidation(
            {
                models: {
                    button: {
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
            }
        );
    });

    test('"reference" fields referencing "data" or "page" models should pass validation', () => {
        expectPassingValidation(
            {
                models: {
                    button: {
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
            }
        );
    });

});
