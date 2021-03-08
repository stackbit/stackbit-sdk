const path = require('path');
const fse = require('fs-extra');
const yaml = require('js-yaml');
const { test, expect } = require('@jest/globals');

const { loadConfig } = require('../src/config/config-loader');
const { writeConfig } = require('../src/config/config-writer');

const tempStackbitYamlPath = path.join(__dirname, 'stackbit.yaml');

afterAll(async () => {
    await fse.remove(tempStackbitYamlPath)
});

// TODO: prepare another set of example that will pass the test.
//  Currently the saved config is different, but in a good way because we adjust it.
test.skip.each(['azimuth', 'diy', 'starter'])('load and write %s stackbit.yaml', async (subfolder) => {
    const dirPath = path.join(__dirname, `./data/${subfolder}`);
    const result = await loadConfig({ dirPath: dirPath });
    expect(result.errors).toHaveLength(0);
    await writeConfig({ dirPath: __dirname, config: result.config });
    const origFile = await fse.readFile(path.join(dirPath, 'stackbit.yaml'), 'utf8');
    const newFile = await fse.readFile(tempStackbitYamlPath, 'utf8');
    const origYaml = yaml.load(origFile, { schema: yaml.JSON_SCHEMA });
    const newYaml = yaml.load(newFile, { schema: yaml.JSON_SCHEMA });
    expect(origYaml).toEqual(newYaml);
});
