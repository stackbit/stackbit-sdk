const { describe, test, expect } = require('@jest/globals');

const { expectPassingValidation, expectValidationResultToMatchAllErrors, loadConfigFromFixturePath } = require('../test-utils');

describe('contentModels property', () => {
    test('should pass validation when contentModels keys reference existing models with matching types', () => {
        expectPassingValidation({
            contentModels: {
                model_1: {
                    newFilePath: 'content/pages/blog/{slug}.md'
                },
                model_2: {
                    newFilePath: 'content/data/authors/{slug}.json'
                }
            },
            models: {
                model_1: {
                    type: 'data',
                    label: 'Model 1'
                },
                model_2: {
                    type: 'data',
                    label: 'Model 2'
                }
            }
        });
    });

    test.each(['object', 'data'])('should fail validation when isPage is true but the referenced model is of type %d', (modelType) => {
        expectValidationResultToMatchAllErrors({
            contentModels: {
                model_1: {
                    isPage: true,
                    urlPath: '{slug}',
                    newFilePath: 'content/pages/blog/{slug}.md'
                }
            },
            models: {
                model_1: {
                    type: modelType,
                    label: 'Model 1'
                }
            }
        }, [
            {
                type: 'contentModel.type.not.page',
                fieldPath: ['contentModels', 'model_1'],
                message: 'The contentModels.model_1.isPage is true, but the referenced model is not of type "page"'
            }
        ]);
    });

    test.each(['object', 'page'])('should fail validation when isPage is false or not defined but the referenced model is of type %d', (modelType) => {
        expectValidationResultToMatchAllErrors({
            contentModels: {
                model_1: {
                    isPage: false,
                    newFilePath: 'content/data/authors/{slug}.json'
                }
            },
            models: {
                model_1: {
                    type: modelType,
                    label: 'Model 1'
                }
            }
        }, [
            {
                type: 'contentModel.type.not.data',
                fieldPath: ['contentModels', 'model_1'],
                message: 'The contentModels.model_1 references a model which is not of type "data"'
            }
        ]);
    });

    test('should pass validation with file matching properties', () => {
        expectPassingValidation({
            contentModels: {
                model_1: {
                    newFilePath: 'content/pages/blog/{slug}.md',
                    folder: 'content/pages/blog',
                    match: '**/*.md',
                    exclude: 'index.md'
                }
            },
            models: {
                model_1: {
                    type: 'data',
                    label: 'Model 1'
                }
            }
        });
    });

    test('should fail validation when contentModels keys reference non existing models', () => {
        expectValidationResultToMatchAllErrors(
            {
                contentModels: {
                    model_2: {
                        newFilePath: 'content/data/authors/{slug}.json'
                    }
                },
                models: {
                    model_1: {
                        type: 'object',
                        label: 'Model 1'
                    }
                }
            },
            [
                {
                    type: 'contentModel.model.not.found',
                    fieldPath: ['contentModels', 'model_2'],
                    message: 'The key "model_2" of contentModels must reference the name of an existing model'
                }
            ]
        );
    });

    test('should fail validation when contentModels contain forbidden properties', () => {
        expectValidationResultToMatchAllErrors(
            {
                contentModels: {
                    model_1: {
                        forbidden: 'forbidden'
                    }
                },
                models: {
                    model_1: {
                        type: 'object',
                        label: 'Model 1'
                    }
                }
            },
            [
                {
                    type: 'object.unknown',
                    fieldPath: ['contentModels', 'model_1', 'forbidden'],
                    message: 'contentModels.model_1.forbidden is not allowed'
                }
            ]
        );
    });

    test.each(['folder', 'match', 'exclude'])('should fail validation when contentModels contain both the "file" and the "%s" properties', (property) => {
        expectValidationResultToMatchAllErrors(
            {
                contentModels: {
                    model_1: {
                        file: 'data.json',
                        [property]: 'data'
                    }
                },
                models: {
                    model_1: {
                        type: 'object',
                        label: 'Model 1'
                    }
                }
            },
            [
                {
                    type: 'object.without',
                    fieldPath: ['contentModels', 'model_1'],
                    message: `file conflict with forbidden peer ${property}`
                }
            ]
        );
    });

    test('should fail validation when "isPage" is not "true" and page specific properties are provided', () => {
        expectValidationResultToMatchAllErrors(
            {
                contentModels: {
                    model_1: {
                        urlPath: '/blog/{slug}',
                        hideContent: true,
                        newFilePath: 'content/pages/blog/{slug}.md'
                    }
                },
                models: {
                    model_1: {
                        type: 'object',
                        label: 'Model 1'
                    }
                }
            },
            [
                {
                    type: 'object.unknown',
                    fieldPath: ['contentModels', 'model_1', 'urlPath'],
                    message: 'contentModels.model_1.urlPath is not allowed'
                },
                {
                    type: 'object.unknown',
                    fieldPath: ['contentModels', 'model_1', 'hideContent'],
                    message: 'contentModels.model_1.hideContent is not allowed'
                }
            ]
        );
    });

    test('should pass validation when "isPage" is "true" and page specific properties are provided', () => {
        expectPassingValidation({
            contentModels: {
                model_1: {
                    isPage: true,
                    urlPath: '/blog/{slug}',
                    hideContent: true,
                    newFilePath: 'content/pages/blog/{slug}.md'
                }
            },
            models: {
                model_1: {
                    type: 'page',
                    label: 'Model 1'
                }
            }
        });
    });

    test('should extend models when config is loaded', async () => {
        const result = await loadConfigFromFixturePath('content-models');
        expect(result.config.models).toMatchObject([{
            name: 'model_1',
            type: 'page',
            urlPath: '/blog/{slug}',
            filePath: 'blog/{slug}.md',
            folder: 'blog',
            match: ['**/*.md'],
            exclude: ['index.md']
        }, {
            name: 'model_2',
            type: 'data',
            filePath: 'authors/{slug}.json',
            folder: 'authors'
        }, {
            name: 'model_3',
            type: 'object'
        }]);
        expect(result.valid).toBeTruthy();
    });
});
