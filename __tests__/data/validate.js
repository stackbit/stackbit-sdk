const path = require('path');
const { test, expect } = require('@jest/globals');

const { loadConfig } = require('../../dist/config/config-loader');
const { loadContent } = require('../../src/content/content-loader');
const { validate } = require('../../src/content/content-validator');

test.each(['azimuth', 'diy', 'starter'])('load azimuth stackbit.yaml', async (subfolder) => {
    const result = await loadConfig({ dirPath: path.join(__dirname, `./${subfolder}`) });
    expect(result.errors).toHaveLength(0);

    // TODO: make a full converage test for validating content instead of using temp data
    if (subfolder === 'azimuth') {
        const dirPath = path.join(__dirname, `./${subfolder}`);
        const contentResult = await loadContent({
            dirPath: dirPath,
            config: result.config,
            skipUnmodeledContent: false
        });
        expect(contentResult.errors).toHaveLength(0);

        const contentValidationResult = validate({
            contentItems: contentResult.contentItems,
            config: result.config
        });
        expect(contentValidationResult.errors).toHaveLength(0);
    }
});
