const _ = require('lodash');
const util = require('util');
const { expect } = require('@jest/globals');

const { validate } = require('../src/config/config-validator');

const minimalValidConfig = {
    stackbitVersion: '0.3.0'
}


module.exports = {
    expectPassingValidation,
    expectValidationResultToIncludeSingleError,
    expectValidationResultToMatchAllErrors,
    expectArrayToIncludeObjectContaining,
    inspectValidationResultErrors
}

function expectPassingValidation(validatedConfig) {
    const config = _.assign(validatedConfig, minimalValidConfig);
    const result = validate(config);
    expect(result.errors).toHaveLength(0);
    expect(result.valid).toBeTruthy();
}

function expectValidationResultToIncludeSingleError(value, error, options) {
    expectValidationResultToMatchAllErrors(value, [error], options);
}

function expectValidationResultToMatchAllErrors(value, expectedErrors, { inspectErrors = false } = {}) {
    const config = _.assign(value, minimalValidConfig);
    const result = validate(config);
    if (inspectErrors) {
        inspectValidationResultErrors(result);
    }
    expect(result.errors).toMatchObject(expectedErrors);
    expect(result.valid).toBeFalsy();
}

function expectArrayToIncludeObjectContaining(array, object) {
    expect(array).toEqual(
        expect.arrayContaining([
            expect.objectContaining(object)
        ])
    );
}

function inspectValidationResultErrors(result) {
    console.log('error.details: ', util.inspect(result.errors, { showHidden: true, depth: 5, colors: true, compact: false }));
}
