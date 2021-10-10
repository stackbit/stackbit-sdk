const path = require('path');
const util = require('util');
const _ = require('lodash');
const { expect } = require('@jest/globals');

const { validateConfig } = require('../src/config/config-validator');
const { loadConfig, validateAndNormalizeConfig } = require('../src/config/config-loader');

const minimalValidConfig = {
    stackbitVersion: '0.3.0'
};

module.exports = {
    loadConfigFromFixturePath,
    inspectValidationResultErrors,
    getFieldOfModel,

    // expectConfig* methods are using the high-level "validateAndNormalizeConfig" method
    // which is similar to loading the config from stackbit.yaml file and then extending, validating and normalizing it.
    expectConfigPassingValidation,
    expectConfigPassingValidationAndMatchObject,
    expectConfigFailValidationAndMatchAllErrors,

    // other validation methods are using the low-level "validateConfig" utility method
    // that only validate the passed config using the raw Joi schema.
    // TODO: refactor all these methods to use the high-level validation method
    expectPassingValidation,
    expectModelPassingValidation,
    expectValidationResultToIncludeSingleError,
    expectValidationResultToMatchAllErrors,
    expectModelValidationResultToMatchAllErrors,
    expectArrayToIncludeObjectContaining
};

async function loadConfigFromFixturePath(fixturePath) {
    const stackbitYamlPath = path.join(__dirname, 'fixtures', fixturePath);
    return loadConfig({ dirPath: stackbitYamlPath });
}

function expectConfigPassingValidation(validatedConfig) {
    const config = _.assign(validatedConfig, minimalValidConfig);
    const result = validateAndNormalizeConfig(config);
    expect(result.errors).toHaveLength(0);
    expect(result.valid).toBeTruthy();
}

function expectConfigPassingValidationAndMatchObject(validatedConfig, expectedConfig) {
    const config = _.assign(validatedConfig, minimalValidConfig);
    const result = validateAndNormalizeConfig(config);
    expect(result.config).toMatchObject(expectedConfig);
    expect(result.errors).toHaveLength(0);
    expect(result.valid).toBeTruthy();
}

function expectConfigFailValidationAndMatchAllErrors(value, expectedErrors, { inspectErrors = false } = {}) {
    const config = _.assign(value, minimalValidConfig);
    const result = validateAndNormalizeConfig(config);
    if (inspectErrors) {
        inspectValidationResultErrors(result);
    }
    expect(result.errors).toMatchObject(expectedErrors);
    expect(result.valid).toBeFalsy();
}

function expectPassingValidation(validatedConfig) {
    const config = _.assign(validatedConfig, minimalValidConfig);
    const result = validateConfig(config);
    expect(result.errors).toHaveLength(0);
    expect(result.valid).toBeTruthy();
}

function expectValidationResultToIncludeSingleError(value, error, options) {
    expectValidationResultToMatchAllErrors(value, [error], options);
}

function expectValidationResultToMatchAllErrors(value, expectedErrors, { inspectErrors = false } = {}) {
    const config = _.assign(value, minimalValidConfig);
    const result = validateConfig(config);
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
