const { join } = require('path');
const { FileSystemFileBrowserAdapter } = require('../../src/analyzer/file-browser');
const { FileBrowser } = require('../../src/analyzer/file-browser');
const { matchSSG } = require('../../src/analyzer/ssg-matcher');
const { generateSchema } = require('../../src/analyzer/schema-generator');

describe('generate schema', () => {
    test('empty repo', async () => {
        const emptyRepoPath = join(__dirname, '../fixtures/empty-repo');
        const fileBrowserAdapter = new FileSystemFileBrowserAdapter({ dirPath: emptyRepoPath });
        const schemaGeneratorResult = await generateSchema({ ssgMatchResult: null, fileBrowserAdapter });
        expect(schemaGeneratorResult).toStrictEqual({ dataDir: undefined, models: [], pagesDir: undefined });
    });

    test('gatsby-starter-blog', async () => {
        const sitePath = join(__dirname, '../fixtures/gatsby-sites/gatsby-starter-blog');
        const fileBrowserAdapter = new FileSystemFileBrowserAdapter({ dirPath: sitePath });
        const fileBrowser = new FileBrowser({ fileBrowserAdapter });
        const ssgMatchResult = await matchSSG({ fileBrowser });
        const schemaGeneratorResult = await generateSchema({ ssgMatchResult: ssgMatchResult, fileBrowserAdapter });
        expect(schemaGeneratorResult).toStrictEqual({
            pagesDir: 'content/blog',
            dataDir: undefined,
            models: [
                {
                    type: 'page',
                    name: 'blog',
                    label: 'Blog',
                    match: '**/*',
                    fields: [
                        {
                            "type": "string",
                            "name": "title",
                            "label": "Title"
                        },
                        {
                            "type": "datetime",
                            "name": "date",
                            "label": "Date"
                        },
                        {
                            "type": "string",
                            "name": "description",
                            "label": "Description"
                        },
                        {
                            "type": "markdown",
                            "name": "markdown_content",
                            "label": "Markdown Content"
                        }
                    ]
                }
            ]
        });
    });
});
