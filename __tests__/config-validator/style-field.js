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
                                    },
                                    subtitle: {
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
                    message: 'models.model_1.fields[0].styles.title does not match any model field name or the "self" keyword'
                },
                {
                    type: 'style.field.not.found',
                    fieldPath: ['models', 'model_1', 'fields', 0, 'styles'],
                    message: 'models.model_1.fields[0].styles.subtitle does not match any model field name or the "self" keyword'
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

    test('should fail validation for style attributes that can not have catch all "*" string', () => {
        expectConfigFailValidationAndMatchAllErrors({
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
                                    fontFamily: '*',
                                    textColor: '*',
                                    backgroundColor: '*',
                                    borderColor: '*'
                                }
                            }
                        }
                    ]
                }
            }
        }, [
            {
                type: 'array.base',
                fieldPath: ['models', 'model_1', 'fields', 1, 'styles', 'title', 'fontFamily'],
                message: 'models.model_1.fields[1].styles.title.fontFamily must be an array'
            },
            {
                type: 'array.base',
                fieldPath: ['models', 'model_1', 'fields', 1, 'styles', 'title', 'textColor'],
                message: 'models.model_1.fields[1].styles.title.textColor must be an array'
            },
            {
                type: 'array.base',
                fieldPath: ['models', 'model_1', 'fields', 1, 'styles', 'title', 'backgroundColor'],
                message: 'models.model_1.fields[1].styles.title.backgroundColor must be an array'
            },
            {
                type: 'array.base',
                fieldPath: ['models', 'model_1', 'fields', 1, 'styles', 'title', 'borderColor'],
                message: 'models.model_1.fields[1].styles.title.borderColor must be an array'
            }
        ]);
    });

    test('should pass validation for style attributes that can have catch all "*" string', () => {
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
                                    objectFit: '*',
                                    objectPosition: '*',
                                    flexDirection: '*',
                                    justifyItems: '*',
                                    justifySelf: '*',
                                    alignItems: '*',
                                    alignSelf: '*',
                                    padding: '*',
                                    margin: '*',
                                    width: '*',
                                    height: '*',
                                    fontSize: '*',
                                    fontStyle: '*',
                                    fontWeight: '*',
                                    textAlign: '*',
                                    textDecoration: '*',
                                    backgroundPosition: '*',
                                    backgroundSize: '*',
                                    borderRadius: '*',
                                    borderWidth: '*',
                                    borderStyle: '*',
                                    boxShadow: '*',
                                    opacity: '*'
                                }
                            }
                        }
                    ]
                }
            }
        });
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
                                type: 'style',
                                name: 'styles',
                                styles: {
                                    title: {
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
                    type: 'object.base',
                    fieldPath: ['models', 'model_1', 'fields', 1, 'styles', 'title', 'fontFamily', 0],
                    message: 'models.model_1.fields[1].styles.title.fontFamily[0] must be of type object'
                },
                {
                    type: 'any.required',
                    fieldPath: ['models', 'model_1', 'fields', 1, 'styles', 'self', 'fontFamily', 0, 'label'],
                    message: 'models.model_1.fields[1].styles.self.fontFamily[0].label is required'
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
                        '["*", fontWeight pattern, array of fontWeight pattern, ' +
                        'array of ["100", "200", "300", "400", "500", "600", "700", "800", "900"]]'
                },
                {
                    type: 'string.pattern.base',
                    fieldPath: ['models', 'model_1', 'fields', 2, 'styles', 'subtitle', 'fontWeight'],
                    message:
                        'models.model_1.fields[2].styles.subtitle.fontWeight with value 100 ' +
                        'fails to match the required pattern: /^[1-8]00:[2-9]00$/'
                },
                {
                    type: 'alternatives.types',
                    fieldPath: ['models', 'model_1', 'fields', 2, 'styles', 'self', 'fontWeight'],
                    message:
                        'models.model_1.fields[2].styles.self.fontWeight must be one of ' +
                        '["*", fontWeight pattern, array of fontWeight pattern, ' +
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
                                type: 'style',
                                name: 'styles',
                                styles: {
                                    title: {
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
                    type: 'object.base',
                    fieldPath: ['models', 'model_1', 'fields', 1, 'styles', 'title', 'textColor', 0],
                    message: 'models.model_1.fields[1].styles.title.textColor[0] must be of type object'
                },
                {
                    type: 'any.required',
                    fieldPath: ['models', 'model_1', 'fields', 1, 'styles', 'self', 'textColor', 0, 'label'],
                    message: 'models.model_1.fields[1].styles.self.textColor[0].label is required'
                },
                {
                    type: 'any.required',
                    fieldPath: ['models', 'model_1', 'fields', 1, 'styles', 'self', 'textColor', 0, 'color'],
                    message: 'models.model_1.fields[1].styles.self.textColor[0].color is required'
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
                    type: 'string.pattern.base',
                    fieldPath: ['models', 'model_1', 'fields', 2, 'styles', 'title', 'opacity'],
                    message:
                        'models.model_1.fields[2].styles.title.opacity with value 10 ' +
                        'fails to match the required pattern: /^[1-9]?[05]:(?:5|[1-9][05]|100)$/'
                },
                {
                    type: 'alternatives.types',
                    fieldPath: ['models', 'model_1', 'fields', 2, 'styles', 'subtitle', 'opacity'],
                    message:
                        'models.model_1.fields[2].styles.subtitle.opacity must be one of ' +
                        '["*", opacity pattern, array of opacity pattern, array of valid opacity numeric values]'
                },
                {
                    type: 'alternatives.types',
                    fieldPath: ['models', 'model_1', 'fields', 2, 'styles', 'self', 'opacity'],
                    message:
                        'models.model_1.fields[2].styles.self.opacity must be one of ' +
                        '["*", opacity pattern, array of opacity pattern, array of valid opacity numeric values]'
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
                                    textAlign: ['left', 'right'],
                                    objectPosition: ['top', 'center', 'bottom'],
                                    padding: 'x',
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
                                    fontWeight: ['100', '200', '400:800'],
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
                                    opacity: '10:50'
                                },
                                self: {
                                    padding: 'x4:10:2',
                                    margin: ['x0:10', 'y0:10:2'],
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
