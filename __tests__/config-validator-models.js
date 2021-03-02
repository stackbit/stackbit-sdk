const { describe, expect, test } = require('@jest/globals');

const {
    expectPassingValidation,
    expectValidationResultToMatchAllErrors
} = require('./test-utils');


describe('model names', () => {

    test('model names must adhere naming rules', () => {
        expectValidationResultToMatchAllErrors(
            {
                models: {
                    _post: { type: 'page', label: 'Post' }
                }
            },
            [
                {
                    type: 'model.name.pattern.match',
                    path: ['models', '_post'],
                    message: expect.stringContaining('Invalid model name "_post" at "models._post"')
                }
            ]
        );
    });

});

describe('model "type" must be valid', () => {
    test('model without "type" property should fail validation', () => {
        expectValidationResultToMatchAllErrors(
            { models: { post: {} } },
            [
                {
                    type: 'any.required',
                    path: ['models', 'post', 'type'],
                    message: 'models.post.type is required'
                }
            ]
        );
    });

    test('model with illegal "type" value should fail validation', () => {
        expectValidationResultToMatchAllErrors(
            { models: { post: { type: 'illegal' } } },
            [
                {
                    type: 'any.only',
                    path: ['models', 'post', 'type'],
                    message: 'models.post.type must be one of [page, data, config, object]'
                }
            ]
        );
    });

    test.each([
        { models: { post: { type: 'page', label: 'Post' } } },
        { models: { post: { type: 'data', label: 'Author' } } },
        { models: { post: { type: 'object', label: 'Button' } } }
    ])('model with valid "type" value should pass validation', (config) => {
        expectPassingValidation(config);
    });
});

describe('model "label" property is required', () => {

    test('object model without "label" property should fail validation', () => {
        expectValidationResultToMatchAllErrors(
            {
                models: {
                    author: {
                        type: 'object'
                    }
                }
            },
            [
                {
                    type: 'any.required',
                    path: ['models', 'author', 'label'],
                    message: 'models.author.label is required'
                }
            ]
        );
    });

    test('object model with "label" property should pass validation', () => {
        expectPassingValidation({
            models: {
                author: {
                    type: 'object',
                    label: 'Author'
                }
            }
        });
    });
});

describe('model "extends" property references existing "object" model', () => {

    test('model with "extends" property referencing non existing model should fail validation', () => {
        expectValidationResultToMatchAllErrors(
            {
                models: {
                    author: {
                        type: 'object',
                        label: 'Author',
                        extends: 'person'
                    }
                }
            },
            [
                {
                    type: 'model.name.of.object.models',
                    path: ['models', 'author', 'extends'],
                    message: '"models.author.extends" must reference the name of an existing model of type "object", got "person"'
                }
            ]
        );
    });

    test('model with "extends" property referencing non "object" model should fail validation', () => {
        expectValidationResultToMatchAllErrors(
            {
                models: {
                    author: {
                        type: 'object',
                        label: 'Author',
                        extends: 'post'
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
                    path: ['models', 'author', 'extends'],
                    message: '"models.author.extends" must reference the name of an existing model of type "object", got "post"'
                }
            ]
        );
    });

    test('model with "extends" property referenceing "object" model should pass validation', () => {
        expectPassingValidation({
            models: {
                author: {
                    type: 'object',
                    label: 'Author',
                    extends: 'person'
                },
                person: {
                    type: 'object',
                    label: 'Person'
                }
            }
        });
    });
});

describe('"object" model "labelField" property references one of the model fields', () => {

    test('"object" model with "labelField" property and without any fields should fail validation', () => {
        expectValidationResultToMatchAllErrors(
            {
                models: {
                    author: {
                        type: 'object',
                        label: 'Post',
                        labelField: 'illegalField'
                    }
                }
            },
            [
                {
                    type: 'any.only',
                    path: ['models', 'author', 'labelField'],
                    message: '"models.author.labelField" must be one of model field names, got "illegalField"'
                }
            ]
        );
    });

    test('"object" model with "labelField" property referencing non existing fields should fail validation', () => {
        expectValidationResultToMatchAllErrors(
            {
                models: {
                    author: {
                        type: 'object',
                        label: 'Post',
                        labelField: 'illegalField',
                        fields: [{ type: 'string', name: 'someField' }]
                    }
                }
            },
            [
                {
                    type: 'any.only',
                    path: ['models', 'author', 'labelField'],
                    message: '"models.author.labelField" must be one of model field names, got "illegalField"'
                }
            ]
        );
    })

    test('"object" model with "labelField" property referencing an existing field should pass validation', () => {
        expectPassingValidation({
            models: {
                author: {
                    type: 'object',
                    label: 'Post',
                    labelField: 'someField',
                    fields: [{ type: 'string', name: 'someField' }]
                }
            }
        });
    });
});

describe('"data" model with "file" property', () => {

    test('"data" model with "file", "folder", "match" and "exclude" properties should fail validation', () => {
        expectValidationResultToMatchAllErrors(
            {
                models: {
                    author: {
                        type: 'data',
                        label: 'Author',
                        file: 'data/author.json',
                        folder: 'data/authors',
                        match: '**/*.json',
                        exclude: '**/*.md'
                    }
                }
            },
            [
                { type: 'model.file.only', path: ['models', 'author', 'folder'], message: 'models.author.folder can not be used with "file"' },
                { type: 'model.file.only', path: ['models', 'author', 'match'], message: 'models.author.match can not be used with "file"' },
                { type: 'model.file.only', path: ['models', 'author', 'exclude'], message: 'models.author.exclude can not be used with "file"' }
            ]
        );
    });

    test('"data" model with "file" without "folder", "match" and "exclude" properties should pass validation', () => {
        expectPassingValidation({
            models: {
                author: {
                    type: 'data',
                    label: 'Author',
                    file: 'data/author.json'
                }
            }
        });
    });

    test('"data" model with "file" and fields with a forbidden field should fail validation', () => {
        expectValidationResultToMatchAllErrors(
            {
                models: {
                    author: {
                        type: 'data',
                        label: 'Author',
                        file: 'data/author.json',
                        fields: [
                            {
                                type: 'string',
                                name: 'title',
                                labelField: ['title']
                            }
                        ]
                    }
                }
            },
            [
                {
                    type: 'object.unknown',
                    path: ['models', 'author', 'fields', 0, 'labelField'],
                    message: 'models.author.fields[0].labelField is not allowed'
                }
            ]
        );
    });

    test('"data" model with "folder", "match" and "exclude" properties without "file" property should pass validation', () => {
        expectPassingValidation({
            models: {
                author: {
                    type: 'data',
                    label: 'Author',
                    folder: 'data/authors',
                    match: '**/*.json',
                    exclude: '**/*.md'
                }
            }
        });
    });
});

describe('"data" model with "isList: true"', () => {

    test('"data" model with "isList: true" without "items" property should fail validation', () => {
        expectValidationResultToMatchAllErrors(
            {
                models: {
                    author: {
                        type: 'data',
                        label: 'Author',
                        file: 'data/author.json',
                        isList: true
                    }
                }
            },
            [
                {
                    type: 'model.isList.items.required',
                    path: ['models', 'author', 'items'],
                    message: 'models.author.items is required when "isList" is true'
                }
            ]
        );
    });

    test('"data" model without "isList: true" and with "items" property should fail validation', () => {
        expectValidationResultToMatchAllErrors(
            {
                models: {
                    author: {
                        type: 'data',
                        label: 'Author',
                        file: 'data/author.json',
                        items: {}
                    }
                }
            },
            [
                {
                    type: 'model.items.forbidden',
                    path: ['models', 'author', 'items'],
                    message: 'models.author.items is not allowed when "isList" is not true'
                }
            ]
        );
    });

    test('"data" model with "isList: true", with "items" property and with "fields" property should fail validation', () => {
        expectValidationResultToMatchAllErrors(
            {
                models: {
                    author: {
                        type: 'data',
                        label: 'Author',
                        file: 'data/author.json',
                        isList: true,
                        items: {
                            type: 'object',
                            fields: []
                        },
                        fields: []
                    }
                }
            },
            [
                {
                    type: 'model.isList.fields.forbidden',
                    path: ['models', 'author', 'fields'],
                    message: 'models.author.fields is not allowed when "isList" is true'
                }
            ]
        );
    });

    test('"data" model with "isList: true" and with "items" property should pass validation', () => {
        expectPassingValidation({
            models: {
                author: {
                    type: 'data',
                    label: 'Author',
                    file: 'data/author.json',
                    isList: true,
                    items: {
                        type: 'string'
                    }
                }
            }
        });
    });

    test('"data" model with "isList: true" and with "items" with a forbidden field should fail validation', () => {
        expectValidationResultToMatchAllErrors(
            {
                models: {
                    author: {
                        type: 'data',
                        label: 'Author',
                        file: 'data/author.json',
                        isList: true,
                        items: {
                            type: 'string',
                            fieldLabel: 'title'
                        }
                    }
                }
            },
            [
                {
                    type: 'object.unknown',
                    path: ['models', 'author', 'items', 'fieldLabel'],
                    message: 'models.author.items.fieldLabel is not allowed'
                }
            ]
        );
    });

    test('"data" model with "isList: true" and with "items" without a required property should fail validation', () => {
        expectValidationResultToMatchAllErrors(
            {
                models: {
                    author: {
                        type: 'data',
                        label: 'Author',
                        file: 'data/author.json',
                        isList: true,
                        items: {
                            type: 'enum'
                        }
                    }
                }
            },
            [
                {
                    type: 'any.required',
                    path: ['models', 'author', 'items', 'options'],
                    message: 'models.author.items.options is required'
                }
            ]
        );
    });
});

describe('"page" model "file" and "singleInstance" properties are mutual exclusive with "folder", "match" and "exclude" properties', () => {

    test('"page" model with "file" and without "singleInstance: true" should fail validation', () => {
        expectValidationResultToMatchAllErrors(
            {
                models: {
                    post: {
                        type: 'page',
                        label: 'Post',
                        file: 'data/author.json'
                    }
                }
            },
            [
                {
                    type: 'any.required',
                    path: ['models', 'post', 'singleInstance'],
                    message: 'models.post.singleInstance is required'
                }
            ]
        );
    });

    test('"page" model with "singleInstance: true" and without "file" should fail validation', () => {
        expectValidationResultToMatchAllErrors(
            {
                models: {
                    post: {
                        type: 'page',
                        label: 'Post',
                        singleInstance: true
                    }
                }
            },
            [
                {
                    type: 'any.required',
                    path: ['models', 'post', 'file'],
                    message: 'models.post.file is required'
                }
            ]
        );
    });

    test('"page" model with "file" and with "singleInstance: true" should pass validation', () => {
        expectPassingValidation({
            models: {
                post: {
                    type: 'page',
                    label: 'Post',
                    singleInstance: true,
                    file: 'data/author.json'
                }
            }
        });
    });

    test('"page" model with "file" and with "singleInstance: true" and a fields with a forbidden field should fail validation', () => {
        expectValidationResultToMatchAllErrors({
            models: {
                post: {
                    type: 'page',
                    label: 'Post',
                    singleInstance: true,
                    file: 'data/author.json',
                    fields: [{
                        type: 'string',
                        name: 'title',
                        labelField: 'title'
                    }]
                }
            }
        }, [
            {
                type: 'object.unknown',
                path: ['models', 'post', 'fields', 0, 'labelField'],
                message: 'models.post.fields[0].labelField is not allowed'
            }
        ]);
    });

    test('"page" model with "file", "folder", "match" and "exclude" properties should fail validation', () => {
        expectValidationResultToMatchAllErrors(
            {
                models: {
                    post: {
                        type: 'page',
                        label: 'Post',
                        singleInstance: true,
                        file: 'data/author.json',
                        folder: 'posts',
                        match: '**/*.md',
                        exclude: '**/*.json'
                    }
                }
            },
            [
                { type: 'model.file.only', path: ['models', 'post', 'folder'], message: 'models.post.folder can not be used with "file"' },
                { type: 'model.file.only', path: ['models', 'post', 'match'], message: 'models.post.match can not be used with "file"' },
                { type: 'model.file.only', path: ['models', 'post', 'exclude'], message: 'models.post.exclude can not be used with "file"' }
            ]
        );
    });

    test('"page" model with "folder", "match" and "exclude" properties without "file" property should pass validation', () => {
        expectPassingValidation({
            models: {
                post: {
                    type: 'page',
                    label: 'Post',
                    folder: 'posts',
                    match: '**/*.md',
                    exclude: '**/*.json'
                }
            }
        });
    });
});
