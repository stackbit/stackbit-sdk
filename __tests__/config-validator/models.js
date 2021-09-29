const { describe, expect, test } = require('@jest/globals');

const { expectPassingValidation, expectValidationResultToMatchAllErrors, expectConfigPassingValidationAndMatchObject } = require('../test-utils');

describe('model name', () => {
    test('should fail validation if set to illegal value', () => {
        expectValidationResultToMatchAllErrors(
            {
                models: {
                    _post: { type: 'page', label: 'Post' }
                }
            },
            [
                {
                    type: 'model.name.pattern.match',
                    fieldPath: ['models', '_post'],
                    message: expect.stringContaining('Invalid model name "_post" at "models._post"')
                }
            ]
        );
    });
});

describe('model "type" property', () => {
    test('should fail validation if not defined', () => {
        expectValidationResultToMatchAllErrors({ models: { post: {} } }, [
            {
                type: 'any.required',
                fieldPath: ['models', 'post', 'type'],
                message: 'models.post.type is required'
            }
        ]);
    });

    test('should fail validation if set to illegal value', () => {
        expectValidationResultToMatchAllErrors({ models: { post: { type: 'illegal' } } }, [
            {
                type: 'any.only',
                fieldPath: ['models', 'post', 'type'],
                message: 'models.post.type must be one of [page, data, config, object]'
            }
        ]);
    });

    test.each([
        { models: { post: { type: 'page', label: 'Post' } } },
        { models: { post: { type: 'data', label: 'Author' } } },
        { models: { post: { type: 'object', label: 'Button' } } }
    ])('should pass validation if set to valid value', (config) => {
        expectPassingValidation(config);
    });
});

describe('model "label" property', () => {
    test('should fail validation if not defined', () => {
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
                    fieldPath: ['models', 'author', 'label'],
                    message: 'models.author.label is required'
                }
            ]
        );
    });

    test('should pass validation if defined', () => {
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

describe('model "extends" property', () => {
    test('should fail validation when referencing non existing model', () => {
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
                    type: 'model.not.object.model',
                    fieldPath: ['models', 'author', 'extends'],
                    message: 'models.author.extends must reference the name of an existing model of type "object", got "person"'
                }
            ]
        );
    });

    test('should fail validation when referencing an object other than "object" type', () => {
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
                    type: 'model.not.object.model',
                    fieldPath: ['models', 'author', 'extends'],
                    message: 'models.author.extends must reference the name of an existing model of type "object", got "post"'
                }
            ]
        );
    });

    test('should pass validation when referencing a model of the "object" type', () => {
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
                { type: 'model.file.only', fieldPath: ['models', 'author', 'folder'], message: 'models.author.folder cannot be used with "file"' },
                { type: 'model.file.only', fieldPath: ['models', 'author', 'match'], message: 'models.author.match cannot be used with "file"' },
                { type: 'model.file.only', fieldPath: ['models', 'author', 'exclude'], message: 'models.author.exclude cannot be used with "file"' }
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
                    fieldPath: ['models', 'author', 'fields', 0, 'labelField'],
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

    test('"data" model with "match" and "exclude" as strings should be converted to arrays of strings', async () => {
        expectConfigPassingValidationAndMatchObject(
            {
                models: {
                    author: {
                        type: 'data',
                        label: 'Author',
                        folder: 'data/authors',
                        match: '**/*.json',
                        exclude: '**/*.md'
                    }
                }
            },
            {
                models: [
                    {
                        name: 'author',
                        type: 'data',
                        folder: 'data/authors',
                        match: ['**/*.json'],
                        exclude: ['**/*.md']
                    }
                ]
            }
        );
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
                    fieldPath: ['models', 'author', 'items'],
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
                    fieldPath: ['models', 'author', 'items'],
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
                    fieldPath: ['models', 'author', 'fields'],
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
                    fieldPath: ['models', 'author', 'items', 'fieldLabel'],
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
                    fieldPath: ['models', 'author', 'items', 'options'],
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
                    fieldPath: ['models', 'post', 'singleInstance'],
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
                    fieldPath: ['models', 'post', 'file'],
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
        expectValidationResultToMatchAllErrors(
            {
                models: {
                    post: {
                        type: 'page',
                        label: 'Post',
                        singleInstance: true,
                        file: 'data/author.json',
                        fields: [
                            {
                                type: 'string',
                                name: 'title',
                                labelField: 'title'
                            }
                        ]
                    }
                }
            },
            [
                {
                    type: 'object.unknown',
                    fieldPath: ['models', 'post', 'fields', 0, 'labelField'],
                    message: 'models.post.fields[0].labelField is not allowed'
                }
            ]
        );
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
                { type: 'model.file.only', fieldPath: ['models', 'post', 'folder'], message: 'models.post.folder cannot be used with "file"' },
                { type: 'model.file.only', fieldPath: ['models', 'post', 'match'], message: 'models.post.match cannot be used with "file"' },
                { type: 'model.file.only', fieldPath: ['models', 'post', 'exclude'], message: 'models.post.exclude cannot be used with "file"' }
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

    test('"page" model with "match" and "exclude" as strings should be converted to arrays of strings', async () => {
        expectConfigPassingValidationAndMatchObject(
            {
                models: {
                    post: {
                        type: 'page',
                        label: 'Post',
                        folder: 'posts',
                        match: '**/*.md',
                        exclude: '**/*.json'
                    }
                }
            },
            {
                models: [
                    {
                        name: 'post',
                        type: 'page',
                        label: 'Post',
                        folder: 'posts',
                        match: ['**/*.md'],
                        exclude: ['**/*.json']
                    }
                ]
            }
        );
    });
});
