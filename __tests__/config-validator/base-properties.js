const { describe, expect, test } = require('@jest/globals');

const { expectPassingValidation, expectValidationResultToIncludeSingleError, expectValidationResultToMatchAllErrors } = require('../test-utils');

test('invalid ssgName should fail validation', () => {
    expectValidationResultToIncludeSingleError(
        { ssgName: 'invalid' },
        {
            type: 'any.only',
            fieldPath: ['ssgName'],
            message: expect.stringContaining('"ssgName" must be one of')
        }
    );
});

test('staticDir is mutual exclusive with assets', () => {
    expectValidationResultToIncludeSingleError(
        {
            staticDir: 'static',
            assets: {
                referenceType: 'static',
                staticDir: '',
                publicPath: ''
            }
        },
        {
            type: 'object.without',
            message: '"assets" conflict with forbidden peer "staticDir"'
        }
    );
});

test('uploadDir is mutual exclusive with assets', () => {
    expectValidationResultToIncludeSingleError(
        {
            uploadDir: 'uploads',
            assets: {
                referenceType: 'static',
                staticDir: '',
                publicPath: ''
            }
        },
        {
            type: 'object.without',
            message: '"assets" conflict with forbidden peer "uploadDir"'
        }
    );
});

describe('static assets', () => {
    test('should pass validation when "referenceType" is "static", and the "staticDir" and the "publicPath" properties are specified', () => {
        expectPassingValidation({
            assets: {
                referenceType: 'static',
                staticDir: '',
                publicPath: ''
            }
        });
    });

    test('should fail validation when "referenceType" is "static" and "staticDir" is not specified', () => {
        expectValidationResultToIncludeSingleError(
            {
                assets: {
                    referenceType: 'static',
                    publicPath: ''
                }
            },
            {
                type: 'any.required',
                fieldPath: ['assets', 'staticDir'],
                message: '"assets.staticDir" is required'
            }
        );
    });

    test('should fail validation when "referenceType" is "static" and "publicPath" is not specified', () => {
        expectValidationResultToIncludeSingleError(
            {
                assets: {
                    referenceType: 'static',
                    staticDir: ''
                }
            },
            {
                type: 'any.required',
                fieldPath: ['assets', 'publicPath'],
                message: '"assets.publicPath" is required'
            }
        );
    });
});

describe('relative assets', () => {
    test('should pass validation when "referenceType" is "relative" and "assetsDir" property is specified', () => {
        expectPassingValidation({
            assets: {
                referenceType: 'relative',
                assetsDir: ''
            }
        });
    });

    test('should fail validation when "referenceType" is "relative" and "assetsDir" is not specified', () => {
        expectValidationResultToIncludeSingleError(
            {
                assets: {
                    referenceType: 'relative'
                }
            },
            {
                type: 'any.required',
                fieldPath: ['assets', 'assetsDir'],
                message: '"assets.assetsDir" is required'
            }
        );
    });
});

describe('mutual exclusive properties with api-based cms', () => {
    test.each([
        // git cms is assumed if cmsName is not specified
        { pagesDir: '', dataDir: '', excludePages: [] },
        { cmsName: 'netlifycms', pagesDir: '', dataDir: '', excludePages: [] },
        { cmsName: 'forestry', pagesDir: '', dataDir: '', excludePages: [] }
    ])('file-based CMS with file-based schema properties should pass validation', (config) => {
        expectPassingValidation(config);
    });

    test.each([
        [
            { cmsName: 'contentful', staticDir: '', uploadDir: '' },
            [
                { type: 'any.unknown', fieldPath: ['staticDir'] },
                { type: 'any.unknown', fieldPath: ['uploadDir'] }
            ]
        ],
        [
            { cmsName: 'sanity', pagesDir: '', dataDir: '', excludePages: [] },
            [
                { type: 'any.unknown', fieldPath: ['pagesDir'] },
                { type: 'any.unknown', fieldPath: ['dataDir'] },
                { type: 'any.unknown', fieldPath: ['excludePages'] }
            ]
        ]
    ])('api-based CMS with file-based schema properties should fail validation', (config, expectedErrors) => {
        expectValidationResultToMatchAllErrors(config, expectedErrors);
    });
});
