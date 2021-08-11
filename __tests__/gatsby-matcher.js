const path = require('path');
const { test, expect } = require('@jest/globals');

const { matchSSG, FileBrowser, FileSystemFileBrowserAdapter } = require('../src');

test('test gatsby matcher', async () => {
    const dirPath = path.join(__dirname, './fixtures/gatsby-sites/gatsby-starter-blog');
    const fileBrowserAdapter = new FileSystemFileBrowserAdapter({ dirPath });
    const fileBrowser = new FileBrowser({ fileBrowserAdapter });
    const ssgMatchResult = await matchSSG({ fileBrowser });
    expect(ssgMatchResult).toEqual({
        ssgName: 'gatsby',
        publishDir: 'public',
        staticDir: 'static',
        ssgDir: '',
        contentDirs: [ 'content/blog', 'src/images' ],
        nodeVersion: '12'
    });
});
