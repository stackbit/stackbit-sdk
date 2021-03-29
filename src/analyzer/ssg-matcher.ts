import path from 'path';
import _ from 'lodash';
import { FileBrowser, FileBrowserAdapterInterface } from './file-browser';
import { extractNodeEnvironmentVariablesFromFile, findDirsWithPackageDependency } from './analyzer-utils';

export interface SSGMatcherOptions {
    fileBrowserAdapter?: FileBrowserAdapterInterface;
    fileBrowser?: FileBrowser;
}

export interface SSGMatchResult {
    ssgName: string;
    ssgDir?: string;
    isTheme?: boolean;
    pagesDir?: string;
    dataDir?: string;
    staticDir?: string;
    envVars?: string[];
    options?: {
        ssgDirs?: string[];
    };
}

export async function matchSSG({ fileBrowser, fileBrowserAdapter }: SSGMatcherOptions): Promise<SSGMatchResult | null> {
    if (!fileBrowser) {
        if (!fileBrowserAdapter) {
            throw new Error('either fileBrowser or fileBrowserAdapter must be provided to SSG matcher');
        }
        fileBrowser = new FileBrowser({ fileBrowserAdapter });
    }
    await fileBrowser.listFiles();
    return getFirstMatchedSSG(fileBrowser);
}

async function getFirstMatchedSSG(fileBrowser: FileBrowser): Promise<SSGMatchResult | null> {
    let partialMatch = null;
    let ssgMatcher = null;
    for (ssgMatcher of SSGMatchers) {
        if (ssgMatcher.match) {
            partialMatch = await ssgMatcher.match(fileBrowser!);
            break;
        } else if (ssgMatcher.matchByPackageName) {
            partialMatch = await matchSSGByPackageName(fileBrowser!, ssgMatcher.matchByPackageName);
            break;
        }
    }
    if (!partialMatch || !ssgMatcher) {
        return null;
    }
    return {
        ssgName: ssgMatcher.name,
        ...partialMatch
    };
}

async function matchSSGByPackageName(fileBrowser: FileBrowser, packageName: string): Promise<Omit<SSGMatchResult, 'ssgName'> | null> {
    const dirs = await findDirsWithPackageDependency(fileBrowser, packageName);
    if (dirs.length === 1) {
        return {
            ssgDir: dirs[0]
        };
    } else if (dirs.length > 1) {
        return {
            options: {
                ssgDirs: dirs
            }
        };
    }
    return null;
}

interface SSGMatcher {
    name: string;
    matchByPackageName?: string;
    match?: (fileBrowser: FileBrowser) => Promise<Omit<SSGMatchResult, 'ssgName'> | null>;
}

const SSGMatchers: SSGMatcher[] = [
    {
        name: 'gatsby',
        match: async (fileBrowser) => {
            const partialMatch = await matchSSGByPackageName(fileBrowser, 'gatsby');
            if (!partialMatch || partialMatch.ssgDir === undefined) {
                return partialMatch;
            }
            const gatsbyConfigPath = path.join(partialMatch.ssgDir, 'gatsby-config.js');
            const envVars = await extractNodeEnvironmentVariablesFromFile(fileBrowser, gatsbyConfigPath);
            if (!_.isEmpty(envVars)) {
                partialMatch.envVars = envVars;
            }
            return partialMatch;
        }
    },
    {
        name: 'nextjs',
        matchByPackageName: 'next'
    },
    {
        name: 'hexo',
        matchByPackageName: 'hexo'
    },
    {
        name: 'eleventy',
        matchByPackageName: '@11ty/eleventy'
    },
    {
        name: 'vuepress',
        matchByPackageName: 'vuepress'
    },
    {
        name: 'gridsome',
        matchByPackageName: 'gridsome'
    },
    {
        name: 'nuxt',
        matchByPackageName: 'nuxt'
    },
    {
        name: 'sapper',
        matchByPackageName: 'sapper'
    },
    {
        name: 'hugo',
        match: async (fileBrowser) => {
            let configFiles = ['config.toml', 'config.yaml', 'config.json'];
            configFiles = configFiles.concat(_.map(configFiles, (configFile) => 'config/_default/' + configFile));
            configFiles = configFiles.concat(_.map(configFiles, (configFile) => 'exampleSite/' + configFile));
            const configFilePath = _.find(configFiles, (filePath) => fileBrowser.filePathExists(filePath));
            // if no 'config.*' file found in main locations, try to find other config files inside config sub-folders
            if (!configFilePath) {
                const configFiles = fileBrowser.findFiles('config/**/(config|params|menus|languages).(toml|yaml|json)');
                if (configFiles.length === 0) {
                    return null;
                }
            }
            const dirMap = {
                archetypeDir: 'archetypes',
                assetDir: 'assets',
                contentDir: 'content',
                dataDir: 'data',
                layoutDir: 'layouts',
                staticDir: 'static'
            };
            if (configFilePath) {
                const configData = fileBrowser.getFileData(configFilePath);
                _.assign(dirMap, _.pick(configData, _.keys(dirMap)));
            }
            let directories = _.values(dirMap);
            directories = directories.concat(_.map(directories, (dir) => 'exampleSite/' + dir));
            const minNumOfDirs = 2;
            const numOfExistingFolders = _.reduce(directories, (count, dirPath) => count + (fileBrowser.directoryPathExists(dirPath) ? 1 : 0), 0);
            if (numOfExistingFolders < minNumOfDirs) {
                return null;
            }
            const isTheme = fileBrowser.filePathExists('theme.toml') || fileBrowser.directoryPathExists('exampleSite');
            return {
                ssgDir: '',
                isTheme: isTheme,
                pagesDir: dirMap.contentDir,
                dataDir: dirMap.dataDir,
                staticDir: dirMap.staticDir
            };
        }
    },
    {
        name: 'jekyll',
        match: async (fileBrowser) => {
            // We (Stackbit) can only run Jekyll sites, or themes, that have explicitly defined specific 'jekyll' or
            // 'github-pages' as a dependency. Having jekyll plugin dependencies such as 'jekyll-paginate' and
            // 'jekyll-sitemap' is not enough because Stackbit will not be able to run Jekyll if 'bundle install' will
            // not install correct Jekyll version.
            const gemNames = ['jekyll', 'github-pages'];
            const gemspecFilePaths = fileBrowser.findFiles('*.gemspec');
            let hasGemspecWithJekyll = false;
            if (gemspecFilePaths.length > 0) {
                for (let i = 0; i < gemspecFilePaths.length; i++) {
                    const filePath = gemspecFilePaths[i]!;
                    const gemspecData = await fileBrowser.getFileData(filePath);
                    const hasDependency = _.some(gemNames, (gemName) => {
                        return (
                            gemspecData.includes(`add_runtime_dependency "${gemName}"`) ||
                            gemspecData.includes(`add_runtime_dependency '${gemName}'`) ||
                            gemspecData.includes(`add_development_dependency "${gemName}"`) ||
                            gemspecData.includes(`add_development_dependency '${gemName}'`)
                        );
                    });
                    if (hasDependency) {
                        hasGemspecWithJekyll = true;
                        break;
                    }
                }
            }

            const gemfilePath = 'Gemfile';
            const fileExists = fileBrowser.filePathExists(gemfilePath);
            let hasGemfileWithJekyll = false;
            if (!hasGemspecWithJekyll && fileExists) {
                const gemfileData = await fileBrowser.getFileData(gemfilePath);
                hasGemfileWithJekyll = _.some(gemNames, (gemName) => {
                    return gemfileData.includes(`gem "${gemName}"`) || gemfileData.includes(`gem '${gemName}'`);
                });
            }

            const configFiles = ['_config.yml', '_config.toml'];
            const configFilePath = _.find(configFiles, (filePath) => fileBrowser.filePathExists(filePath));
            const dirMap = {
                source: '',
                data_dir: '_data',
                plugins_dir: '_plugins',
                layouts_dir: '_layouts',
                includes_dir: '_includes'
            };
            if (configFilePath) {
                const configData = fileBrowser.getFileData(configFilePath);
                _.assign(dirMap, _.pick(configData, _.keys(dirMap)));
            }
            const match = {
                ssgDir: '',
                pagesDir: dirMap.source,
                dataDir: dirMap.data_dir,
                staticDir: dirMap.source,
                isTheme: hasGemspecWithJekyll
            };

            if (hasGemfileWithJekyll || hasGemspecWithJekyll) {
                return match;
            }
            const folders = _.values(_.pick(dirMap, ['layouts_dir', 'includes_dir', 'data_dir', 'plugins_dir'])).concat('_posts');
            const minNumOfDirs = 2;
            const numOfExistingFolders = _.reduce(folders, (count, dirPath) => count + (fileBrowser.directoryPathExists(dirPath) ? 1 : 0), 0);
            if (numOfExistingFolders < minNumOfDirs) {
                return null;
            }
            return match;
        }
    }
];
