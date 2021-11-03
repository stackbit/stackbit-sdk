const { describe, test } = require('@jest/globals');
const { expectContentPassingValidation, expectContentFailValidationAndMatchAllErrors } = require('../test-utils');

describe('test content validation for "style" field', () => {
    test('should pass validation with valid style values when style config set to match all "*"', () => {
        expectContentPassingValidation(
            {
                models: {
                    model_1: {
                        type: 'data',
                        label: 'Model 1',
                        fields: [
                            {
                                type: 'style',
                                name: 'styles',
                                styles: {
                                    self: {
                                        objectFit: '*',
                                        objectPosition: '*',
                                        flexDirection: '*',
                                        justifyContent: '*',
                                        justifyItems: '*',
                                        justifySelf: '*',
                                        alignContent: '*',
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
            },
            [
                {
                    __metadata: {
                        modelName: 'model_1',
                        filePath: 'file.json'
                    },
                    styles: {
                        self: {
                            objectFit: 'contain',
                            objectPosition: 'center',
                            flexDirection: 'row',
                            justifyContent: 'flex-start',
                            justifyItems: 'start',
                            justifySelf: 'start',
                            alignContent: 'stretch',
                            alignItems: 'flex-start',
                            alignSelf: 'flex-start',
                            padding: { left: 10, right: 10 },
                            margin: { top: 10, bottom: 10 },
                            width: 'auto',
                            height: 'auto',
                            fontSize: 'medium',
                            fontStyle: 'normal',
                            fontWeight: '500',
                            textAlign: 'center',
                            textDecoration: 'underline',
                            backgroundPosition: 'left-top',
                            backgroundSize: 'cover',
                            borderRadius: 'small',
                            borderWidth: 10,
                            borderStyle: 'solid',
                            boxShadow: 'small',
                            opacity: 10
                        }
                    }
                }
            ]
        );
    });

    test('should pass validation with valid style values when style config set to specific values', () => {
        const colors = [
            { value: 'color-1', label: 'Color 1', color: '#ffffff' },
            { value: 'color-2', label: 'Color 2', color: '#000000' }
        ];
        expectContentPassingValidation(
            {
                models: {
                    model_1: {
                        type: 'data',
                        label: 'Model 1',
                        fields: [
                            {
                                type: 'style',
                                name: 'styles',
                                styles: {
                                    self: {
                                        objectFit: ['contain', 'cover', 'fill'],
                                        objectPosition: ['top', 'center', 'bottom'],
                                        flexDirection: ['row', 'row-reverse'],
                                        justifyContent: ['space-between', 'space-around', 'space-evenly'],
                                        justifyItems: ['start', 'end'],
                                        justifySelf: ['start', 'end'],
                                        alignContent: ['center', 'stretch'],
                                        alignItems: ['flex-start', 'flex-end'],
                                        alignSelf: ['flex-start', 'flex-end'],
                                        padding: 'x',
                                        margin: ['y0:10', 'x0:4'],
                                        width: ['narrow', 'wide'],
                                        height: ['full', 'screen'],
                                        fontFamily: [
                                            { value: 'font-1', label: 'Font 1' },
                                            { value: 'font-2', label: 'Font 2' }
                                        ],
                                        fontSize: ['small', 'medium', 'large'],
                                        fontStyle: ['normal', 'italic'],
                                        fontWeight: '100:500',
                                        textAlign: ['left', 'center', 'right'],
                                        textColor: colors,
                                        textDecoration: ['none', 'underline'],
                                        backgroundColor: colors,
                                        backgroundPosition: ['left', 'right'],
                                        backgroundSize: ['auto', 'cover'],
                                        borderRadius: ['xx-small', 'x-small', 'small', 'medium'],
                                        borderWidth: '0:10',
                                        borderColor: colors,
                                        borderStyle: ['solid', 'dashed', 'dotted'],
                                        boxShadow: ['none', 'x-small', 'small', 'medium'],
                                        opacity: '0:50'
                                    }
                                }
                            }
                        ]
                    }
                }
            },
            [
                {
                    __metadata: {
                        modelName: 'model_1',
                        filePath: 'file.json'
                    },
                    styles: {
                        self: {
                            objectFit: 'contain',
                            objectPosition: 'center',
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            justifyItems: 'start',
                            justifySelf: 'end',
                            alignContent: 'stretch',
                            alignItems: 'flex-start',
                            alignSelf: 'flex-end',
                            padding: { left: 10, right: 20 },
                            margin: { left: 2, right: 4, top: 6, bottom: 4 },
                            width: 'narrow',
                            height: 'full',
                            fontFamily: 'font-1',
                            fontSize: 'small',
                            fontStyle: 'normal',
                            fontWeight: '400',
                            textAlign: 'center',
                            textColor: 'color-1',
                            textDecoration: 'underline',
                            backgroundColor: 'color-1',
                            backgroundPosition: 'left',
                            backgroundSize: 'auto',
                            borderRadius: 'small',
                            borderWidth: 6,
                            borderColor: 'color-2',
                            borderStyle: 'solid',
                            boxShadow: 'none',
                            opacity: 15
                        }
                    }
                }
            ]
        );
    });

    test('should fail validation with invalid style values when style config set to match all "*"', () => {
        const colors = [
            { value: 'color-1', label: 'Color 1', color: '#ffffff' },
            { value: 'color-2', label: 'Color 2', color: '#000000' }
        ];
        expectContentFailValidationAndMatchAllErrors(
            {
                models: {
                    model_1: {
                        type: 'data',
                        label: 'Model 1',
                        fields: [
                            {
                                type: 'style',
                                name: 'styles',
                                styles: {
                                    self: {
                                        objectFit: '*',
                                        objectPosition: '*',
                                        flexDirection: '*',
                                        justifyContent: '*',
                                        justifyItems: '*',
                                        justifySelf: '*',
                                        alignContent: '*',
                                        alignItems: '*',
                                        alignSelf: '*',
                                        padding: '*',
                                        margin: '*',
                                        width: '*',
                                        height: '*',
                                        fontFamily: [
                                            { value: 'font-1', label: 'Font 1' },
                                            { value: 'font-2', label: 'Font 2' }
                                        ],
                                        fontSize: '*',
                                        fontStyle: '*',
                                        fontWeight: '*',
                                        textAlign: '*',
                                        textColor: colors,
                                        textDecoration: '*',
                                        backgroundColor: colors,
                                        backgroundPosition: '*',
                                        backgroundSize: '*',
                                        borderRadius: '*',
                                        borderWidth: '*',
                                        borderColor: colors,
                                        borderStyle: '*',
                                        boxShadow: '*',
                                        opacity: '*'
                                    }
                                }
                            }
                        ]
                    }
                }
            },
            [
                {
                    __metadata: {
                        modelName: 'model_1',
                        filePath: 'file.json'
                    },
                    styles: {
                        self: {
                            objectFit: 'illegal',
                            objectPosition: 'illegal',
                            flexDirection: 'illegal',
                            justifyContent: 'illegal',
                            justifyItems: 'illegal',
                            justifySelf: 'illegal',
                            alignItems: 'illegal',
                            alignContent: 'illegal',
                            alignSelf: 'illegal',
                            padding: 'illegal',
                            margin: 10,
                            width: 'illegal',
                            height: 'illegal',
                            fontFamily: 'illegal',
                            fontSize: 'illegal',
                            fontStyle: 'illegal',
                            fontWeight: '150',
                            textAlign: 'illegal',
                            textColor: 'illegal',
                            textDecoration: 'illegal',
                            backgroundColor: 'illegal',
                            backgroundPosition: 'illegal',
                            backgroundSize: 'illegal',
                            borderRadius: 'illegal',
                            borderWidth: 'illegal',
                            borderColor: 'illegal',
                            borderStyle: 'illegal',
                            boxShadow: 'illegal',
                            opacity: 7
                        }
                    }
                }
            ],
            [
                {
                    type: 'any.only',
                    fieldPath: ['styles', 'self', 'objectFit'],
                    message: '"styles.self.objectFit" must be one of [none, contain, cover, fill, scale-down]'
                },
                {
                    type: 'any.only',
                    fieldPath: ['styles', 'self', 'objectPosition'],
                    message: '"styles.self.objectPosition" must be one of [top, center, bottom, left, left-top, left-bottom, right, right-top, right-bottom]'
                },
                {
                    type: 'any.only',
                    fieldPath: ['styles', 'self', 'flexDirection'],
                    message: '"styles.self.flexDirection" must be one of [row, row-reverse, col, col-reverse]'
                },
                {
                    type: 'any.only',
                    fieldPath: ['styles', 'self', 'justifyContent'],
                    message: '"styles.self.justifyContent" must be one of [flex-start, flex-end, center, space-between, space-around, space-evenly]'
                },
                {
                    type: 'any.only',
                    fieldPath: ['styles', 'self', 'justifyItems'],
                    message: '"styles.self.justifyItems" must be one of [start, end, center, stretch]'
                },
                {
                    type: 'any.only',
                    fieldPath: ['styles', 'self', 'justifySelf'],
                    message: '"styles.self.justifySelf" must be one of [auto, start, end, center, stretch]'
                },
                {
                    type: 'any.only',
                    fieldPath: ['styles', 'self', 'alignContent'],
                    message: '"styles.self.alignContent" must be one of [flex-start, flex-end, center, space-between, space-around, space-evenly, stretch]'
                },
                {
                    type: 'any.only',
                    fieldPath: ['styles', 'self', 'alignItems'],
                    message: '"styles.self.alignItems" must be one of [flex-start, flex-end, center, baseline, stretch]'
                },
                {
                    type: 'any.only',
                    fieldPath: ['styles', 'self', 'alignSelf'],
                    message: '"styles.self.alignSelf" must be one of [auto, flex-start, flex-end, center, baseline, stretch]'
                },
                {
                    type: 'object.base',
                    fieldPath: ['styles', 'self', 'padding'],
                    message: '"styles.self.padding" must be of type object'
                },
                {
                    type: 'object.base',
                    fieldPath: ['styles', 'self', 'margin'],
                    message: '"styles.self.margin" must be of type object'
                },
                {
                    type: 'any.only',
                    fieldPath: ['styles', 'self', 'width'],
                    message: '"styles.self.width" must be one of [auto, narrow, wide, full]'
                },
                {
                    type: 'any.only',
                    fieldPath: ['styles', 'self', 'height'],
                    message: '"styles.self.height" must be one of [auto, full, screen]'
                },
                {
                    type: 'any.only',
                    fieldPath: ['styles', 'self', 'fontFamily'],
                    message: '"styles.self.fontFamily" must be one of [font-1, font-2]'
                },
                {
                    type: 'any.only',
                    fieldPath: ['styles', 'self', 'fontSize'],
                    message: '"styles.self.fontSize" must be one of [xx-small, x-small, small, medium, large, x-large, xx-large, xxx-large]'
                },
                {
                    type: 'any.only',
                    message: '"styles.self.fontStyle" must be one of [normal, italic]',
                    fieldPath: ['styles', 'self', 'fontStyle']
                },
                {
                    type: 'any.only',
                    fieldPath: ['styles', 'self', 'fontWeight'],
                    message: '"styles.self.fontWeight" must be one of [100, 200, 300, 400, 500, 600, 700, 800, 900]'
                },
                {
                    type: 'any.only',
                    fieldPath: ['styles', 'self', 'textAlign'],
                    message: '"styles.self.textAlign" must be one of [left, center, right, justify]'
                },
                {
                    type: 'any.only',
                    fieldPath: ['styles', 'self', 'textColor'],
                    message: '"styles.self.textColor" must be one of [color-1, color-2]'
                },
                {
                    type: 'any.only',
                    fieldPath: ['styles', 'self', 'textDecoration'],
                    message: '"styles.self.textDecoration" must be one of [none, underline, line-through]'
                },
                {
                    type: 'any.only',
                    fieldPath: ['styles', 'self', 'backgroundColor'],
                    message: '"styles.self.backgroundColor" must be one of [color-1, color-2]'
                },
                {
                    type: 'any.only',
                    fieldPath: ['styles', 'self', 'backgroundPosition'],
                    message:
                        '"styles.self.backgroundPosition" must be one of [top, center, bottom, left, left-top, left-bottom, right, right-top, right-bottom]'
                },
                {
                    type: 'any.only',
                    fieldPath: ['styles', 'self', 'backgroundSize'],
                    message: '"styles.self.backgroundSize" must be one of [auto, cover, contain]'
                },
                {
                    type: 'any.only',
                    fieldPath: ['styles', 'self', 'borderRadius'],
                    message: '"styles.self.borderRadius" must be one of [none, xx-small, x-small, small, medium, large, x-large, xx-large, full]'
                },
                {
                    type: 'number.base',
                    fieldPath: ['styles', 'self', 'borderWidth'],
                    message: '"styles.self.borderWidth" must be a number'
                },
                {
                    type: 'any.only',
                    fieldPath: ['styles', 'self', 'borderColor'],
                    message: '"styles.self.borderColor" must be one of [color-1, color-2]'
                },
                {
                    type: 'any.only',
                    fieldPath: ['styles', 'self', 'borderStyle'],
                    message: '"styles.self.borderStyle" must be one of [solid, dashed, dotted, double, none]'
                },
                {
                    type: 'any.only',
                    fieldPath: ['styles', 'self', 'boxShadow'],
                    message: '"styles.self.boxShadow" must be one of [none, x-small, small, medium, large, x-large, xx-large, inner]'
                },
                {
                    type: 'number.multiple',
                    fieldPath: ['styles', 'self', 'opacity'],
                    message: '"styles.self.opacity" must be a multiple of 5'
                }
            ]
        );
    });

    test('should fail validation with invalid style values when style config set to specific values', () => {
        const colors = [
            { value: 'color-1', label: 'Color 1', color: '#ffffff' },
            { value: 'color-2', label: 'Color 2', color: '#000000' }
        ];
        expectContentFailValidationAndMatchAllErrors(
            {
                models: {
                    model_1: {
                        type: 'data',
                        label: 'Model 1',
                        fields: [
                            {
                                type: 'style',
                                name: 'styles',
                                styles: {
                                    self: {
                                        objectFit: ['contain', 'cover', 'fill'],
                                        objectPosition: ['top', 'center', 'bottom'],
                                        flexDirection: ['row', 'row-reverse'],
                                        justifyContent: ['flex-start', 'flex-end'],
                                        justifyItems: ['start', 'end'],
                                        justifySelf: ['start', 'end'],
                                        alignContent: ['flex-start', 'flex-end'],
                                        alignItems: ['flex-start', 'flex-end'],
                                        alignSelf: ['flex-start', 'flex-end'],
                                        padding: 'x',
                                        margin: 'y0:10',
                                        width: ['narrow', 'wide'],
                                        height: ['full', 'screen'],
                                        fontFamily: [
                                            { value: 'font-1', label: 'Font 1' },
                                            { value: 'font-2', label: 'Font 2' }
                                        ],
                                        fontSize: ['small', 'medium', 'large'],
                                        fontStyle: ['normal', 'italic'],
                                        fontWeight: '100:500',
                                        textAlign: ['left', 'center', 'right'],
                                        textColor: colors,
                                        textDecoration: ['none', 'underline'],
                                        backgroundColor: colors,
                                        backgroundPosition: ['left', 'right'],
                                        backgroundSize: ['auto', 'cover'],
                                        borderRadius: ['xx-small', 'x-small', 'small', 'medium'],
                                        borderWidth: '0:10',
                                        borderColor: colors,
                                        borderStyle: ['solid', 'dashed', 'dotted'],
                                        boxShadow: ['none', 'x-small', 'small', 'medium'],
                                        opacity: '0:50'
                                    }
                                }
                            }
                        ]
                    }
                }
            },
            [
                {
                    __metadata: {
                        modelName: 'model_1',
                        filePath: 'file.json'
                    },
                    styles: {
                        self: {
                            objectFit: 'scale-down',
                            objectPosition: 'left-top',
                            flexDirection: 'col',
                            justifyContent: 'center',
                            justifyItems: 'center',
                            justifySelf: 'center',
                            alignContent: 'center',
                            alignItems: 'center',
                            alignSelf: 'center',
                            padding: { top: 10 },
                            margin: { top: 16 },
                            width: 'auto',
                            height: 'auto',
                            fontFamily: 'font-3',
                            fontSize: 'x-small',
                            fontStyle: 'illegal',
                            fontWeight: '600',
                            textAlign: 'justify',
                            textColor: 'color-3',
                            textDecoration: 'line-through',
                            backgroundColor: 'color-3',
                            backgroundPosition: 'top',
                            backgroundSize: 'contain',
                            borderRadius: 'large',
                            borderWidth: 12,
                            borderColor: 'color-3',
                            borderStyle: 'double',
                            boxShadow: 'large',
                            opacity: 60
                        }
                    }
                }
            ],
            [
                {
                    type: 'any.only',
                    fieldPath: ['styles', 'self', 'objectFit'],
                    message: '"styles.self.objectFit" must be one of [contain, cover, fill]',
                    value: 'scale-down'
                },
                {
                    type: 'any.only',
                    fieldPath: ['styles', 'self', 'objectPosition'],
                    message: '"styles.self.objectPosition" must be one of [top, center, bottom]',
                    value: 'left-top'
                },
                {
                    type: 'any.only',
                    fieldPath: ['styles', 'self', 'flexDirection'],
                    message: '"styles.self.flexDirection" must be one of [row, row-reverse]',
                    value: 'col'
                },
                {
                    type: 'any.only',
                    fieldPath: ['styles', 'self', 'justifyContent'],
                    message: '"styles.self.justifyContent" must be one of [flex-start, flex-end]',
                    value: 'center'
                },
                {
                    type: 'any.only',
                    fieldPath: ['styles', 'self', 'justifyItems'],
                    message: '"styles.self.justifyItems" must be one of [start, end]',
                    value: 'center'
                },
                {
                    type: 'any.only',
                    fieldPath: ['styles', 'self', 'justifySelf'],
                    message: '"styles.self.justifySelf" must be one of [start, end]',
                    value: 'center'
                },
                {
                    type: 'any.only',
                    fieldPath: ['styles', 'self', 'alignContent'],
                    message: '"styles.self.alignContent" must be one of [flex-start, flex-end]',
                    value: 'center'
                },
                {
                    type: 'any.only',
                    fieldPath: ['styles', 'self', 'alignItems'],
                    message: '"styles.self.alignItems" must be one of [flex-start, flex-end]',
                    value: 'center'
                },
                {
                    type: 'any.only',
                    fieldPath: ['styles', 'self', 'alignSelf'],
                    message: '"styles.self.alignSelf" must be one of [flex-start, flex-end]',
                    value: 'center'
                },
                {
                    type: 'object.unknown',
                    fieldPath: ['styles', 'self', 'padding', 'top'],
                    message: '"styles.self.padding.top" is not allowed',
                    value: 10
                },
                {
                    type: 'number.max',
                    fieldPath: ['styles', 'self', 'margin', 'top'],
                    message: '"styles.self.margin.top" must be less than or equal to 10',
                    value: 16
                },
                {
                    type: 'any.only',
                    fieldPath: ['styles', 'self', 'width'],
                    message: '"styles.self.width" must be one of [narrow, wide]',
                    value: 'auto'
                },
                {
                    type: 'any.only',
                    fieldPath: ['styles', 'self', 'height'],
                    message: '"styles.self.height" must be one of [full, screen]',
                    value: 'auto'
                },
                {
                    type: 'any.only',
                    fieldPath: ['styles', 'self', 'fontFamily'],
                    message: '"styles.self.fontFamily" must be one of [font-1, font-2]',
                    value: 'font-3'
                },
                {
                    type: 'any.only',
                    fieldPath: ['styles', 'self', 'fontSize'],
                    message: '"styles.self.fontSize" must be one of [small, medium, large]',
                    value: 'x-small'
                },
                {
                    type: 'any.only',
                    message: '"styles.self.fontStyle" must be one of [normal, italic]',
                    fieldPath: ['styles', 'self', 'fontStyle'],
                    value: 'illegal'
                },
                {
                    type: 'any.only',
                    fieldPath: ['styles', 'self', 'fontWeight'],
                    message: '"styles.self.fontWeight" must be one of [100, 200, 300, 400, 500]',
                    value: '600'
                },
                {
                    type: 'any.only',
                    fieldPath: ['styles', 'self', 'textAlign'],
                    message: '"styles.self.textAlign" must be one of [left, center, right]',
                    value: 'justify'
                },
                {
                    type: 'any.only',
                    fieldPath: ['styles', 'self', 'textColor'],
                    message: '"styles.self.textColor" must be one of [color-1, color-2]',
                    value: 'color-3'
                },
                {
                    type: 'any.only',
                    fieldPath: ['styles', 'self', 'textDecoration'],
                    message: '"styles.self.textDecoration" must be one of [none, underline]',
                    value: 'line-through'
                },
                {
                    type: 'any.only',
                    fieldPath: ['styles', 'self', 'backgroundColor'],
                    message: '"styles.self.backgroundColor" must be one of [color-1, color-2]',
                    value: 'color-3'
                },
                {
                    type: 'any.only',
                    fieldPath: ['styles', 'self', 'backgroundPosition'],
                    message: '"styles.self.backgroundPosition" must be one of [left, right]',
                    value: 'top'
                },
                {
                    type: 'any.only',
                    fieldPath: ['styles', 'self', 'backgroundSize'],
                    message: '"styles.self.backgroundSize" must be one of [auto, cover]',
                    value: 'contain'
                },
                {
                    type: 'any.only',
                    fieldPath: ['styles', 'self', 'borderRadius'],
                    message: '"styles.self.borderRadius" must be one of [xx-small, x-small, small, medium]',
                    value: 'large'
                },
                {
                    type: 'number.max',
                    fieldPath: ['styles', 'self', 'borderWidth'],
                    message: '"styles.self.borderWidth" must be less than or equal to 10',
                    value: 12
                },
                {
                    type: 'any.only',
                    fieldPath: ['styles', 'self', 'borderColor'],
                    message: '"styles.self.borderColor" must be one of [color-1, color-2]',
                    value: 'color-3'
                },
                {
                    type: 'any.only',
                    fieldPath: ['styles', 'self', 'borderStyle'],
                    message: '"styles.self.borderStyle" must be one of [solid, dashed, dotted]',
                    value: 'double'
                },
                {
                    type: 'any.only',
                    fieldPath: ['styles', 'self', 'boxShadow'],
                    message: '"styles.self.boxShadow" must be one of [none, x-small, small, medium]',
                    value: 'large'
                },
                {
                    type: 'any.only',
                    fieldPath: ['styles', 'self', 'opacity'],
                    message: '"styles.self.opacity" must be one of [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50]',
                    value: 60
                }
            ]
        );
    });
});
