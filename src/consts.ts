import _ from 'lodash';

const excludedMarkdownFiles = ['LICENSE.md', '**/README.md', 'README.theme.md', 'CONTRIBUTING.md', 'CHANGELOG.md', 'CODE_OF_CONDUCT.md'];

export const MARKDOWN_FILE_EXTENSIONS = ['md', 'mdx', 'markdown'];
export const DATA_FILE_EXTENSIONS = ['yml', 'yaml', 'json', 'toml'];
export const EXCLUDED_MARKDOWN_FILES = _.concat(excludedMarkdownFiles, excludedMarkdownFiles.map(_.toLower));
export const EXCLUDED_DATA_FILES = ['stackbit.yaml', 'netlify.toml', 'theme.toml', '**/package.json', '**/package-lock.json', '**/yarn-lock.json'];
export const EXCLUDED_COMMON_FILES = ['**/node_modules/**', '**/.git/**', '.idea/**', '**/.*'];
