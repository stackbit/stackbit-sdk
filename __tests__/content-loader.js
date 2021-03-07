const path = require('path');
const { test, expect } = require('@jest/globals');

const { loadConfig } = require('../src/config/config-loader');
const { loadContent } = require('../src/content/content-loader');

test.each(['azimuth', 'diy', 'starter'])('load %s stackbit.yaml', async (subfolder) => {
    const dirPath = path.join(__dirname, `./data/${subfolder}`);
    const result = await loadConfig({ dirPath: dirPath });
    expect(result.errors).toHaveLength(0);

    // TODO: make a full coverage test for validating content instead of using temp data
    if (subfolder === 'azimuth') {
        const contentResult = await loadContent({
            dirPath: dirPath,
            config: result.config,
            skipUnmodeledContent: false
        });
        expect(contentResult.errors).toHaveLength(0);
    }
});
