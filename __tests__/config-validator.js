const { describe, expect, test } = require('@jest/globals');

const {
    expectPassingValidation,
    expectValidationResultToIncludeSingleError,
    expectValidationResultToMatchAllErrors
} = require('./test-utils');


test('invalid ssgName validation', () => {
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
    expectValidationResultToIncludeSingleError({
        staticDir: 'static',
        assets: {
            referenceType: 'static',
            staticDir: '',
            publicPath: ''
        }
    }, {
        type: 'object.without'
    });
});

test('uploadDir is mutual exclusive with assets', () => {
    expectValidationResultToIncludeSingleError({
        uploadDir: 'uploads',
        assets: {
            referenceType: 'static',
            staticDir: '',
            publicPath: ''
        }
    }, {
        type: 'object.without'
    });
});

describe('assets with "static" referenceType require "staticDir" and "publicPath" properties', () => {
    test('assets with "static" referenceType, "staticDir" and "publicPath" properties should pass validation', () => {
        expectPassingValidation({
            assets: {
                referenceType: 'static',
                staticDir: '',
                publicPath: ''
            }
        });
    });

    test('assets with "static" referenceType without "staticDir" property should fail validation', () => {
        expectValidationResultToIncludeSingleError({
            assets: {
                referenceType: 'static',
                publicPath: ''
            }
        }, {
            type: 'any.required',
            fieldPath: ['assets', 'staticDir']
        });
    });

    test('assets with "static" referenceType without "publicPath" property should fail validation', () => {
        expectValidationResultToIncludeSingleError({
            assets: {
                referenceType: 'static',
                staticDir: ''
            }
        }, {
            type: 'any.required',
            fieldPath: ['assets', 'publicPath']
        });
    });
});

describe('assets with "relative" referenceType require "assetsDir" property', () => {
    test('assets with "relative" referenceType and "assetsDir" property should pass validation', () => {
        expectPassingValidation({
            assets: {
                referenceType: 'relative',
                assetsDir: ''
            }
        });
    });

    test('assets with "relative" referenceType without "assetsDir" property should fail validation', () => {
        expectValidationResultToIncludeSingleError({
            assets: {
                referenceType: 'relative'
            }
        }, {
            type: 'any.required',
            fieldPath: ['assets', 'assetsDir']
        });
    });
});

describe('mutual exclusive properties with api-based cms', () => {
    test.each([
        // git cms is assumed if cmsType is not specified
        { pagesDir: '', dataDir: '', excludePages: [] },
        { cmsType: 'netlifycms', pagesDir: '', dataDir: '', excludePages: [] },
        { cmsType: 'forestry', pagesDir: '', dataDir: '', excludePages: [] }
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
