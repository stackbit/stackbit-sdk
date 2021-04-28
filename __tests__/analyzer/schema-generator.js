const { join } = require('path');
const { generateSchema } = require('../../src/analyzer/schema-generator');
const { FileSystemFileBrowserAdapter } = require('../../src/analyzer/file-browser');
const emptyRepoPath = join(__dirname, '../data/empty-repo');

describe('generate schema', () => {
    test('empty repo', async () => {
        const fileBrowserAdapter = new FileSystemFileBrowserAdapter({ dirPath: emptyRepoPath });
        const schemaGeneratorResult = await generateSchema({ ssgMatchResult: null, fileBrowserAdapter });
        expect(schemaGeneratorResult).toStrictEqual({ dataDir: undefined, models: [], pagesDir: undefined });
    });
});
