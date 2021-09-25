const path = require('path');
const util = require('util');
const _ = require('lodash');
const { expect } = require('@jest/globals');

const { validate } = require('../src/config/config-validator');
const { loadConfig, sanitizeAndValidateConfig } = require('../src/config/config-loader');

const minimalValidConfig = {
    stackbitVersion: '0.3.0'
};

module.exports = {
    loadConfigFromFixturePath,
    expectPassingValidation,
    expectModelPassingValidation,
    expectConfigToBeSanitizedPassValidationAndMatchObject,
    expectValidationResultToIncludeSingleError,
    expectValidationResultToMatchAllErrors,
    expectModelValidationResultToMatchAllErrors,
    expectArrayToIncludeObjectContaining,
    inspectValidationResultErrors,
    getFieldOfModel
};

async function loadConfigFromFixturePath(fixturePath) {
    const stackbitYamlPath = path.join(__dirname, 'fixtures', fixturePath);
    return loadConfig({ dirPath: stackbitYamlPath });
}

function expectPassingValidation(validatedConfig) {
    const config = _.assign(validatedConfig, minimalValidConfig);
    const result = validate(config);
    expect(result.errors).toHaveLength(0);
    expect(result.valid).toBeTruthy();
}

function expectConfigToBeSanitizedPassValidationAndMatchObject(validatedConfig, expectedConfig) {
    const config = _.assign(validatedConfig, minimalValidConfig);
    const result = sanitizeAndValidateConfig(config);
    expect(result.config).toMatchObject(expectedConfig);
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
    expect(array).toEqual(expect.arrayContaining([expect.objectContaining(object)]));
}

function inspectValidationResultErrors(result) {
    console.log('error.details: ', util.inspect(result.errors, { showHidden: true, depth: 5, colors: true, compact: false }));
}

function getFieldOfModel(models, modelName, fieldName) {
    const model = _.find(models, { name: modelName });
    return _.find(model?.fields, { name: fieldName });
}

function expectModelPassingValidation(model, options) {
    expectPassingValidation(getMinimalModel(model), options);
}

function expectModelValidationResultToMatchAllErrors(model, expectedErrors, options) {
    expectValidationResultToMatchAllErrors(getMinimalModel(model), expectedErrors, options);
}

function getMinimalModel(model) {
    return {
        models: {
            test_model: _.assign(
                {
                    type: 'object',
                    label: 'Test Model'
                },
                model
            )
        }
    };
}
