const _ = require('lodash');
const util = require('util');
const { expect } = require('@jest/globals');

const { stackbitConfigSchema } = require('../src/config/config-schema');

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
    const validationResult = stackbitConfigSchema.validate(config, {abortEarly: false});
    const errors = _.get(validationResult, 'error.details', []);
    expect(errors).toHaveLength(0);
}

function expectValidationResultToIncludeSingleError(value, error, options) {
    expectValidationResultToMatchAllErrors(value, [error], options);
}

function expectValidationResultToMatchAllErrors(value, expectedErrors, { inspectErrors = false } = {}) {
    const config = _.assign(value, minimalValidConfig);
    const validationResult = stackbitConfigSchema.validate(config, {abortEarly: false});
    const errors = _.get(validationResult, 'error.details', []);
    if (inspectErrors) {
        inspectValidationResultErrors(validationResult);
    }
    expect(errors).toMatchObject(expectedErrors);
}

function expectArrayToIncludeObjectContaining(array, object) {
    expect(array).toEqual(
        expect.arrayContaining([
            expect.objectContaining(object)
        ])
    );
}

function inspectValidationResultErrors(validationResult) {
    const errors = _.get(validationResult, 'error.details', []);
    console.log('error.details: ', util.inspect(errors, { showHidden: true, depth: 5, colors: true, compact: false }));
}
