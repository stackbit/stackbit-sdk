const _ = require('lodash');

const { stackbitConfigSchema } = require('./config-schema');


module.exports.validate = function validate(config) {
    const validationOptions = {abortEarly: false};
    const validationResult = stackbitConfigSchema.validate(config, validationOptions);
    const errors = _.get(validationResult, 'error.details', []).map(error => {
        return _.pick(error, ['message', 'path'])
    });
    return {
        valid: _.isEmpty(errors),
        errors
    }
}
