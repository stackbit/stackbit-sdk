const path = require('path');
const { describe, test, expect, beforeAll } = require('@jest/globals');
const _ = require('lodash');

const { getFieldOfModel, expectConfigPassingValidationAndMatchObject } = require('./test-utils');
const { loadConfig } = require('../src/config/config-loader');

test('normalized validation error should have normFieldPath with the normalized path', async () => {
    const azimuthStackbitYamlPath = path.join(__dirname, 'fixtures/schema-with-errors');
    const result = await loadConfig({ dirPath: azimuthStackbitYamlPath });
    expect(result.valid).toBeFalsy();
    expect(_.every(_.take(result.config.models, 4), ['__metadata.invalid', true])).toBeTruthy();
    expect(result.errors).toMatchObject([
        {
            type: 'any.only',
            value: 'invalid_type',
            fieldPath: ['models', 'invalid_1', 'fields', 0, 'type'],
            normFieldPath: ['models', 0, 'fields', 0, 'type']
        },
        {
            type: 'any.required',
            value: undefined,
            fieldPath: ['models', 'invalid_1', 'fields', 1, 'name'],
            normFieldPath: ['models', 0, 'fields', 1, 'name']
        },
        {
            type: 'object.unknown',
            value: 'field',
            fieldPath: ['models', 'invalid_2', 'fields', 0, 'fields', 0, 'illegal'],
            normFieldPath: ['models', 1, 'fields', 0, 'fields', 0, 'illegal']
        },
        {
            type: 'object.unknown',
            value: 'field',
            fieldPath: ['models', 'invalid_2', 'fields', 1, 'items', 'fields', 0, 'illegal'],
            normFieldPath: ['models', 1, 'fields', 1, 'items', 'fields', 0, 'illegal']
        },
        {
            type: 'any.required',
            value: undefined,
            fieldPath: ['models', 'invalid_3', 'file'],
            normFieldPath: ['models', 2, 'file']
        },
        {
            type: 'string.empty',
            value: '',
            fieldPath: ['models', 'invalid_4', 'file'],
            normFieldPath: ['models', 3, 'file']
        }
    ]);
});

test('load and override model files', async () => {
    const stackbitYamlPath = path.join(__dirname, 'fixtures/model-files');
    const result = await loadConfig({ dirPath: stackbitYamlPath });
    expect(result.valid).toBeTruthy();
    const models = _.sortBy(result.config.models, 'name');
    expect(models).toMatchObject([
        {
            name: 'model_1',
            description: 'Model defined in stackbit.yaml'
        },
        {
            name: 'model_components_1',
            description: 'Model defined in @stackbit/components'
        },
        {
            name: 'model_components_2',
            description: 'Model defined in @stackbit/components, overriden by .stackbit/models, overriden by stackbit.yaml'
        },
        {
            name: 'model_components_3',
            description: 'Model defined in @stackbit/components, overriden by .stackbit/models'
        },
        {
            name: 'model_components_4',
            description: 'Model defined in @stackbit/components, overriden by stackbit.yaml'
        },
        {
            name: 'model_components_5',
            description: 'Model defined in @stackbit/components'
        },
        {
            name: 'model_stackbit_1',
            description: 'Model defined in .stackbit/models'
        },
        {
            name: 'model_stackbit_2',
            description: 'Model defined in .stackbit/models overriden by stackbit.yaml'
        }
    ]);
});

test('load and normalize thumbnails', async () => {
    const stackbitYamlPath = path.join(__dirname, 'fixtures/model-files');
    const result = await loadConfig({ dirPath: stackbitYamlPath });
    const models = _.sortBy(result.config.models, 'name');
    expect(models).toMatchObject([
        {
            name: 'model_1',
            thumbnail: 'path/to/thumbnail.png',
            fields: [
                {
                    type: 'enum',
                    name: 'enum_field',
                    options: [
                        {
                            value: 'thumbnail_1',
                            thumbnail: 'path/to/thumbnail.png'
                        },
                        {
                            value: 'thumbnail_2',
                            thumbnail: 'path/to/thumbnail2.png'
                        }
                    ]
                }
            ]
        },
        {
            name: 'model_components_1',
            thumbnail: 'node_modules/@stackbit/components/models/path/to/thumbnail.png',
            fields: [
                {
                    type: 'enum',
                    name: 'enum_field',
                    options: [
                        {
                            value: 'thumbnail_1',
                            thumbnail: 'node_modules/@stackbit/components/models/path/to/thumbnail.png'
                        }
                    ]
                }
            ]
        },
        {
            name: 'model_components_2',
            thumbnail: 'path/to/thumbnail.png',
            fields: [
                {
                    type: 'enum',
                    name: 'enum_field',
                    options: [
                        {
                            value: 'thumbnail_1',
                            thumbnail: 'path/to/thumbnail.png'
                        }
                    ]
                }
            ]
        },
        {
            name: 'model_components_3',
            thumbnail: 'abs/path/thumbnail.png',
            fields: [
                {
                    type: 'enum',
                    name: 'enum_field',
                    options: [
                        {
                            value: 'thumbnail_1',
                            thumbnail: 'abs/path/thumbnail.png'
                        }
                    ]
                }
            ]
        },
        {
            name: 'model_components_4',
            thumbnail: 'path/to/thumbnail.png',
            fields: [
                {
                    type: 'enum',
                    name: 'enum_field',
                    options: [
                        {
                            value: 'thumbnail_1',
                            thumbnail: 'path/to/thumbnail.png'
                        }
                    ]
                }
            ]
        },
        {
            name: 'model_components_5',
            thumbnail: 'node_modules/@stackbit/components/abs/path/thumbnail.png',
            fields: [
                {
                    type: 'enum',
                    name: 'enum_field',
                    options: [
                        {
                            value: 'thumbnail_1',
                            thumbnail: 'node_modules/@stackbit/components/abs/path/thumbnail.png'
                        }
                    ]
                }
            ]
        },
        {
            name: 'model_stackbit_1',
            thumbnail: '.stackbit/models/path/to/thumbnail.png',
            fields: [
                {
                    type: 'enum',
                    name: 'enum_field',
                    options: [
                        {
                            value: 'thumbnail_1',
                            thumbnail: '.stackbit/models/path/to/thumbnail.png'
                        }
                    ]
                }
            ]
        },
        {
            name: 'model_stackbit_2',
            thumbnail: 'path/to/thumbnail.png',
            fields: [
                {
                    type: 'enum',
                    name: 'enum_field',
                    options: [
                        {
                            value: 'thumbnail_1',
                            thumbnail: 'path/to/thumbnail.png'
                        }
                    ]
                }
            ]
        }
    ]);
    expect(result.valid).toBeTruthy();
});

describe('stackbit.yaml default properties', () => {
    let result;
    beforeAll(async () => {
        const stackbitYamlPath = path.join(__dirname, 'fixtures/model-extensions');
        result = await loadConfig({ dirPath: stackbitYamlPath });
    });

    test.skip('config loader should set "pageLayoutKey" to "layout" if not defined', () => {
        expect(result.valid).toBeTruthy();
        expect(result.config.pageLayoutKey).toEqual('layout');
    });

    test.skip('config loader should set "objectTypeKey" to "type" if not defined', () => {
        expect(result.config.objectTypeKey).toEqual('type');
    });
});

describe('internal model fields', () => {
    let result;
    beforeAll(async () => {
        const stackbitYamlPath = path.join(__dirname, 'fixtures/model-extensions');
        result = await loadConfig({ dirPath: stackbitYamlPath });
    });

    test('page model with "layout" property should be extended with "layout" (pageLayoutKey) field if not defined', () => {
        expect(_.find(result.config.models, ['name', 'page_1'])).toMatchObject({
            name: 'page_1',
            layout: 'layout_1',
            fields: expect.arrayContaining([
                expect.objectContaining({
                    type: 'string',
                    name: 'layout',
                    const: 'layout_1'
                })
            ])
        });
    });

    test('page model with a "layout" property and an existing "layout" (pageLayoutKey) field should not override the exiting layout field', () => {
        expect(_.find(result.config.models, ['name', 'page_2'])).toMatchObject({
            name: 'page_2',
            layout: 'layout_2',
            fields: expect.arrayContaining([
                expect.objectContaining({
                    type: 'string',
                    name: 'layout',
                    const: 'custom_layout'
                })
            ])
        });
    });

    test('page without hideContent should add markdown_content field', () => {
        expect(_.find(result.config.models, ['name', 'page_1'])).toMatchObject({
            name: 'page_1',
            fields: expect.arrayContaining([
                expect.objectContaining({
                    type: 'markdown',
                    name: 'markdown_content',
                    label: 'Content'
                })
            ])
        });
    });

    test('page with hideContent=true should not add markdown_content field', () => {
        expect(_.find(result.config.models, ['name', 'page_2'])).toMatchObject({
            name: 'page_2',
            fields: expect.not.arrayContaining([
                expect.objectContaining({
                    type: 'markdown',
                    name: 'markdown_content',
                    label: 'Content'
                })
            ])
        });
    });

    test('models referenced from "reference" fields should be extended with "type" (objectTypeKey) field if not defined', () => {
        expect(_.find(result.config.models, ['name', 'object_2'])).toMatchObject({
            name: 'object_2',
            fields: expect.arrayContaining([
                expect.objectContaining({
                    type: 'string',
                    name: 'type',
                    const: 'object_2',
                    hidden: true
                })
            ])
        });
        expect(_.find(result.config.models, ['name', 'object_3'])).toMatchObject({
            name: 'object_3',
            fields: expect.arrayContaining([
                expect.objectContaining({
                    type: 'string',
                    name: 'custom_type',
                    const: 'custom_value'
                })
            ])
        });
    });

    test('page models without "urlPath" should get a default value', () => {
        expect(_.find(result.config.models, ['name', 'page_1'])).toMatchObject({
            name: 'page_1',
            urlPath: '/{slug}'
        });
    });

    test('page models without "filePath" should get a default value', () => {
        expect(_.find(result.config.models, ['name', 'page_1'])).toMatchObject({
            name: 'page_1',
            urlPath: '/{slug}',
            filePath: 'content/pages/{slug}.md'
        });
    });

    test('page models without "filePath" should get a default value derived from "urlPath"', () => {
        expect(_.find(result.config.models, ['name', 'page_2'])).toMatchObject({
            name: 'page_2',
            urlPath: '/blog/{slug}',
            filePath: 'content/pages/blog/{slug}.md'
        });
    });
});

describe('default values for missing field properties', () => {
    let result;
    beforeAll(async () => {
        const stackbitYamlPath = path.join(__dirname, 'fixtures/model-extensions');
        result = await loadConfig({ dirPath: stackbitYamlPath });
    });

    test('fields without label should get label computed from model name', () => {
        expect(_.find(result.config.models, ['name', 'object_1']).fields).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    type: 'list',
                    name: 'tags',
                    label: 'Tags'
                }),
                expect.objectContaining({
                    type: 'object',
                    name: 'nested_object',
                    label: 'Nested Object',
                    fields: expect.arrayContaining([
                        expect.objectContaining({
                            type: 'list',
                            name: 'nested_tags',
                            label: 'Nested Tags'
                        })
                    ])
                }),
                expect.objectContaining({
                    type: 'list',
                    name: 'nested_object_list',
                    label: 'Nested Object List',
                    items: expect.objectContaining({
                        fields: expect.arrayContaining([
                            expect.objectContaining({
                                type: 'list',
                                name: 'nested_tags',
                                label: 'Nested Tags'
                            })
                        ])
                    })
                })
            ])
        );
    });

    test('object fields without labelField should get computed labelField', () => {
        const field = getFieldOfModel(result.config.models, 'object_1', 'nested_object');
        expect(field).toMatchObject({
            type: 'object',
            name: 'nested_object',
            labelField: 'text'
        });
    });

    test('list fields of objects without labelField should get computed labelField', () => {
        const field = getFieldOfModel(result.config.models, 'object_1', 'nested_object_list');
        expect(field).toMatchObject({
            type: 'list',
            items: expect.objectContaining({
                type: 'object',
                labelField: 'text'
            })
        });
    });

    test('list fields without items type should get default items.type = string', () => {
        const tagsField = getFieldOfModel(result.config.models, 'object_1', 'tags');
        expect(tagsField).toMatchObject({
            type: 'list',
            items: {
                type: 'string'
            }
        });
        const nestedObjectField = getFieldOfModel(result.config.models, 'object_1', 'nested_object');
        expect(nestedObjectField).toMatchObject({
            type: 'object',
            name: 'nested_object',
            fields: expect.arrayContaining([
                expect.objectContaining({
                    type: 'list',
                    name: 'nested_tags',
                    items: {
                        type: 'string'
                    }
                })
            ])
        });
    });
});

describe('stackbit.yaml v0.2.0', () => {
    let result;
    beforeAll(async () => {
        const stackbitYamlPath = path.join(__dirname, 'fixtures/stackbit-v0.2.0');
        result = await loadConfig({ dirPath: stackbitYamlPath });
    });

    test('page model with a "template" property should convert it to "layout" property', () => {
        expect(_.find(result.config.models, ['name', 'page_1'])).toMatchObject({
            name: 'page_1',
            layout: 'layout_1',
            fields: expect.arrayContaining([
                expect.objectContaining({
                    type: 'string',
                    name: 'layout',
                    const: 'layout_1'
                })
            ])
        });
    });

    test('stackbit.yaml v0.2.0 "custom model" field should be converted to model fields', () => {
        const customModelField = getFieldOfModel(result.config.models, 'page_1', 'custom_model_field');
        expect(customModelField).toMatchObject({
            type: 'model',
            models: ['model_1']
        });
        const customModelListField = getFieldOfModel(result.config.models, 'page_1', 'custom_model_list');
        expect(customModelListField).toMatchObject({
            type: 'list',
            items: {
                type: 'model',
                models: ['model_1']
            }
        });
    });

    test('stackbit.yaml v0.2.0 "models" field should be converted to model fields', () => {
        const modelsField = getFieldOfModel(result.config.models, 'page_1', 'models_field');
        expect(modelsField).toMatchObject({
            type: 'model',
            models: ['model_1']
        });
        const modelsListField = getFieldOfModel(result.config.models, 'page_1', 'models_list');
        expect(modelsListField).toMatchObject({
            type: 'list',
            items: {
                type: 'model',
                models: ['model_1']
            }
        });
    });

    test('stackbit.yaml v0.2.0 "reference" field should be converted to model fields', () => {
        const referenceField = getFieldOfModel(result.config.models, 'page_1', 'reference_field');
        expect(referenceField).toMatchObject({
            type: 'model',
            models: ['model_1']
        });
        const referenceListField = getFieldOfModel(result.config.models, 'page_1', 'reference_list');
        expect(referenceListField).toMatchObject({
            type: 'list',
            items: {
                type: 'model',
                models: ['model_1']
            }
        });
    });

    test('stackbit.yaml v0.3.0 "reference" field should not be converted to model fields', async () => {
        const stackbitYamlPath = path.join(__dirname, 'fixtures/model-extensions');
        const result = await loadConfig({ dirPath: stackbitYamlPath });
        const referenceField = getFieldOfModel(result.config.models, 'object_1', 'reference_field');
        expect(referenceField).toMatchObject({
            type: 'reference',
            models: ['object_2', 'object_3']
        });
        const referenceListField = getFieldOfModel(result.config.models, 'object_1', 'reference_list');
        expect(referenceListField).toMatchObject({
            type: 'list',
            items: {
                type: 'reference',
                models: ['object_2', 'object_3']
            }
        });
    });
});

describe('model "extends" property', () => {
    test('model should concat its own fieldGroups and fieldGroups of the extended model and produce unique fieldGroups names', () => {
        expectConfigPassingValidationAndMatchObject(
            {
                models: {
                    model_1: {
                        type: 'object',
                        label: 'Model 1',
                        fieldGroups: [
                            {
                                name: 'group_1',
                                label: 'Group 1'
                            },
                            {
                                name: 'group_2',
                                label: 'Group 2'
                            }
                        ],
                        extends: 'model_2'
                    },
                    model_2: {
                        type: 'object',
                        label: 'Model 2',
                        fieldGroups: [
                            {
                                name: 'group_2',
                                label: 'Group 2 extended'
                            },
                            {
                                name: 'group_3',
                                label: 'Group 3 extended'
                            }
                        ]
                    }
                }
            },
            {
                models: [
                    {
                        name: 'model_1',
                        fieldGroups: [
                            {
                                name: 'group_2',
                                label: 'Group 2 extended'
                            },
                            {
                                name: 'group_3',
                                label: 'Group 3 extended'
                            },
                            {
                                name: 'group_1',
                                label: 'Group 1'
                            }
                        ]
                    },
                    {
                        name: 'model_2'
                    }
                ]
            }
        );
    });
});
