const { describe, test } = require('@jest/globals');
const { expectConfigFailValidationAndMatchAllErrors, expectConfigPassingValidation } = require('../test-utils');

describe('test "style" field', () => {
    test('should fail when "styles" property is not defined', () => {
        expectConfigFailValidationAndMatchAllErrors(
            {
                models: {
                    model_1: {
                        type: 'object',
                        label: 'Model 1',
                        fields: [
                            {
                                type: 'style',
                                name: 'styles'
                            }
                        ]
                    }
                }
            },
            [
                {
                    type: 'any.required',
                    fieldPath: ['models', 'model_1', 'fields', 0, 'styles'],
                    message: 'models.model_1.fields[0].styles is required'
                }
            ]
        );
    });

    test('should fail when referencing non existing model field', () => {
        expectConfigFailValidationAndMatchAllErrors(
            {
                models: {
                    model_1: {
                        type: 'object',
                        label: 'Model 1',
                        fields: [
                            {
                                type: 'style',
                                name: 'styles',
                                styles: {
                                    title: {
                                        textAlign: '*'
                                    }
                                }
                            }
                        ]
                    }
                }
            },
            [
                {
                    type: 'style.field.not.found',
                    fieldPath: ['models', 'model_1', 'fields', 0, 'styles'],
                    message:
                        'models.model_1.fields[0].styles key names must match model field names or the "self" keyword, ' +
                        'the keys: [title] do not match any field names'
                }
            ]
        );
    });

    test('should fail when style attribute is illegal', () => {
        expectConfigFailValidationAndMatchAllErrors(
            {
                models: {
                    model_1: {
                        type: 'object',
                        label: 'Model 1',
                        fields: [
                            {
                                type: 'string',
                                name: 'title'
                            },
                            {
                                type: 'style',
                                name: 'styles',
                                styles: {
                                    title: {
                                        foo: '*'
                                    },
                                    self: {
                                        bar: '*'
                                    }
                                }
                            }
                        ]
                    }
                }
            },
            [
                {
                    type: 'object.unknown',
                    fieldPath: ['models', 'model_1', 'fields', 1, 'styles', 'title', 'foo'],
                    message: 'models.model_1.fields[1].styles.title.foo is not allowed'
                },
                {
                    type: 'object.unknown',
                    fieldPath: ['models', 'model_1', 'fields', 1, 'styles', 'self', 'bar'],
                    message: 'models.model_1.fields[1].styles.self.bar is not allowed'
                }
            ]
        );
    });

    test('should fail when style attribute values have illegal values', () => {
        expectConfigFailValidationAndMatchAllErrors(
            {
                models: {
                    model_1: {
                        type: 'object',
                        label: 'Model 1',
                        fields: [
                            {
                                type: 'string',
                                name: 'title'
                            },
                            {
                                type: 'style',
                                name: 'styles',
                                styles: {
                                    title: {
                                        textAlign: 'left',
                                        objectPosition: ['top-left'],
                                        padding: ['*']
                                    },
                                    self: {
                                        textAlign: ['*'],
                                        margin: ['foo']
                                    }
                                }
                            }
                        ]
                    }
                }
            },
            [
                {
                    type: 'alternatives.types',
                    fieldPath: ['models', 'model_1', 'fields', 1, 'styles', 'title', 'objectPosition'],
                    message:
                        'models.model_1.fields[1].styles.title.objectPosition must be one of ' +
                        '["*", array of ["top", "center", "bottom", "left", "left-top", "left-bottom", "right", "right-top", "right-bottom"]]'
                },
                {
                    type: 'alternatives.types',
                    fieldPath: ['models', 'model_1', 'fields', 1, 'styles', 'title', 'padding'],
                    message: 'models.model_1.fields[1].styles.title.padding must be one of ["*", array of padding pattern]'
                },
                {
                    type: 'alternatives.types',
                    fieldPath: ['models', 'model_1', 'fields', 1, 'styles', 'title', 'textAlign'],
                    message: 'models.model_1.fields[1].styles.title.textAlign must be one of ["*", array of ["left", "center", "right", "justify"]]'
                },
                {
                    type: 'alternatives.types',
                    fieldPath: ['models', 'model_1', 'fields', 1, 'styles', 'self', 'margin'],
                    message: 'models.model_1.fields[1].styles.self.margin must be one of ["*", array of margin pattern]'
                },
                {
                    type: 'alternatives.types',
                    fieldPath: ['models', 'model_1', 'fields', 1, 'styles', 'self', 'textAlign'],
                    message: 'models.model_1.fields[1].styles.self.textAlign must be one of ["*", array of ["left", "center", "right", "justify"]]'
                }
            ]
        );
    });

    test('should fail when the "fontFamily" style attribute has illegal value', () => {
        expectConfigFailValidationAndMatchAllErrors(
            {
                models: {
                    model_1: {
                        type: 'object',
                        label: 'Model 1',
                        fields: [
                            {
                                type: 'string',
                                name: 'title'
                            },
                            {
                                type: 'string',
                                name: 'subtitle'
                            },
                            {
                                type: 'style',
                                name: 'styles',
                                styles: {
                                    title: {
                                        fontFamily: '*'
                                    },
                                    subtitle: {
                                        fontFamily: ['*']
                                    },
                                    self: {
                                        fontFamily: [{ value: 'bar' }]
                                    }
                                }
                            }
                        ]
                    }
                }
            },
            [
                {
                    type: 'array.base',
                    fieldPath: ['models', 'model_1', 'fields', 2, 'styles', 'title', 'fontFamily'],
                    message: 'models.model_1.fields[2].styles.title.fontFamily must be an array'
                },
                {
                    type: 'object.base',
                    fieldPath: ['models', 'model_1', 'fields', 2, 'styles', 'subtitle', 'fontFamily', 0],
                    message: 'models.model_1.fields[2].styles.subtitle.fontFamily[0] must be of type object'
                },
                {
                    type: 'any.required',
                    fieldPath: ['models', 'model_1', 'fields', 2, 'styles', 'self', 'fontFamily', 0, 'label'],
                    message: 'models.model_1.fields[2].styles.self.fontFamily[0].label is required'
                }
            ]
        );
    });

    test('should fail when the "fontWeight" style attribute has illegal value', () => {
        expectConfigFailValidationAndMatchAllErrors(
            {
                models: {
                    model_1: {
                        type: 'object',
                        label: 'Model 1',
                        fields: [
                            {
                                type: 'string',
                                name: 'title'
                            },
                            {
                                type: 'string',
                                name: 'subtitle'
                            },
                            {
                                type: 'style',
                                name: 'styles',
                                styles: {
                                    title: {
                                        fontWeight: ['*']
                                    },
                                    subtitle: {
                                        fontWeight: '100'
                                    },
                                    self: {
                                        fontWeight: [150]
                                    }
                                }
                            }
                        ]
                    }
                }
            },
            [
                {
                    type: 'alternatives.types',
                    fieldPath: ['models', 'model_1', 'fields', 2, 'styles', 'title', 'fontWeight'],
                    message:
                        'models.model_1.fields[2].styles.title.fontWeight must be one of ' +
                        '["*", array of fontWeight pattern, array of valid fontWeight numeric values, ' +
                        'array of ["100", "200", "300", "400", "500", "600", "700", "800", "900"]]'
                },
                {
                    type: 'alternatives.types',
                    fieldPath: ['models', 'model_1', 'fields', 2, 'styles', 'subtitle', 'fontWeight'],
                    message:
                        'models.model_1.fields[2].styles.subtitle.fontWeight must be one of ' +
                        '["*", array of fontWeight pattern, array of valid fontWeight numeric values, ' +
                        'array of ["100", "200", "300", "400", "500", "600", "700", "800", "900"]]'
                },
                {
                    type: 'alternatives.types',
                    fieldPath: ['models', 'model_1', 'fields', 2, 'styles', 'self', 'fontWeight'],
                    message:
                        'models.model_1.fields[2].styles.self.fontWeight must be one of ' +
                        '["*", array of fontWeight pattern, array of valid fontWeight numeric values, ' +
                        'array of ["100", "200", "300", "400", "500", "600", "700", "800", "900"]]'
                }
            ]
        );
    });

    test('should fail when the "textColor" style attribute has illegal value', () => {
        expectConfigFailValidationAndMatchAllErrors(
            {
                models: {
                    model_1: {
                        type: 'object',
                        label: 'Model 1',
                        fields: [
                            {
                                type: 'string',
                                name: 'title'
                            },
                            {
                                type: 'string',
                                name: 'subtitle'
                            },
                            {
                                type: 'style',
                                name: 'styles',
                                styles: {
                                    title: {
                                        textColor: '*'
                                    },
                                    subtitle: {
                                        textColor: ['*']
                                    },
                                    self: {
                                        textColor: [{ value: 'bar' }]
                                    }
                                }
                            }
                        ]
                    }
                }
            },
            [
                {
                    type: 'array.base',
                    fieldPath: ['models', 'model_1', 'fields', 2, 'styles', 'title', 'textColor'],
                    message: 'models.model_1.fields[2].styles.title.textColor must be an array'
                },
                {
                    type: 'object.base',
                    fieldPath: ['models', 'model_1', 'fields', 2, 'styles', 'subtitle', 'textColor', 0],
                    message: 'models.model_1.fields[2].styles.subtitle.textColor[0] must be of type object'
                },
                {
                    type: 'any.required',
                    fieldPath: ['models', 'model_1', 'fields', 2, 'styles', 'self', 'textColor', 0, 'label'],
                    message: 'models.model_1.fields[2].styles.self.textColor[0].label is required'
                },
                {
                    type: 'any.required',
                    fieldPath: ['models', 'model_1', 'fields', 2, 'styles', 'self', 'textColor', 0, 'color'],
                    message: 'models.model_1.fields[2].styles.self.textColor[0].color is required'
                }
            ]
        );
    });

    test('should fail when the "opacity" style attribute has illegal value', () => {
        expectConfigFailValidationAndMatchAllErrors(
            {
                models: {
                    model_1: {
                        type: 'object',
                        label: 'Model 1',
                        fields: [
                            {
                                type: 'string',
                                name: 'title'
                            },
                            {
                                type: 'string',
                                name: 'subtitle'
                            },
                            {
                                type: 'style',
                                name: 'styles',
                                styles: {
                                    title: {
                                        opacity: '10'
                                    },
                                    subtitle: {
                                        opacity: ['*']
                                    },
                                    self: {
                                        opacity: 13
                                    }
                                }
                            }
                        ]
                    }
                }
            },
            [
                {
                    type: 'alternatives.types',
                    fieldPath: ['models', 'model_1', 'fields', 2, 'styles', 'title', 'opacity'],
                    message:
                        'models.model_1.fields[2].styles.title.opacity must be one of ' +
                        '["*", array of valid opacity numeric values, array of opacity pattern]'
                },
                {
                    type: 'alternatives.types',
                    fieldPath: ['models', 'model_1', 'fields', 2, 'styles', 'subtitle', 'opacity'],
                    message:
                        'models.model_1.fields[2].styles.subtitle.opacity must be one of ' +
                        '["*", array of valid opacity numeric values, array of opacity pattern]'
                },
                {
                    type: 'alternatives.types',
                    fieldPath: ['models', 'model_1', 'fields', 2, 'styles', 'self', 'opacity'],
                    message:
                        'models.model_1.fields[2].styles.self.opacity must be one of ' +
                        '["*", array of valid opacity numeric values, array of opacity pattern]'
                }
            ]
        );
    });

    test('should pass validation for valid style attributes and values', () => {
        expectConfigPassingValidation({
            models: {
                model_1: {
                    type: 'object',
                    label: 'Model 1',
                    fields: [
                        {
                            type: 'string',
                            name: 'title'
                        },
                        {
                            type: 'style',
                            name: 'styles',
                            styles: {
                                title: {
                                    textAlign: '*',
                                    objectPosition: '*',
                                    padding: '*',
                                    margin: ['x', 'y'],
                                    fontFamily: [
                                        {
                                            value: 'font-1',
                                            label: 'Font 1'
                                        },
                                        {
                                            value: 'font-2',
                                            label: 'Font 2'
                                        }
                                    ],
                                    fontWeight: '*',
                                    textColor: [
                                        {
                                            value: 'black',
                                            label: 'Black',
                                            color: '#000000'
                                        },
                                        {
                                            value: 'white',
                                            label: 'White',
                                            color: '#ffffff'
                                        }
                                    ],
                                    opacity: '*'
                                },
                                self: {
                                    textAlign: ['left', 'right'],
                                    objectPosition: ['top', 'center', 'bottom'],
                                    padding: 'x',
                                    margin: ['x0:10', 'y0:10:2'],
                                    fontWeight: [100, '200', '400:800'],
                                    opacity: [0, 10, '20', '50:100']
                                }
                            }
                        }
                    ]
                }
            }
        });
    });
});
