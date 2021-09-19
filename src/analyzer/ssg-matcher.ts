import path from 'path';
import _ from 'lodash';
import semver from 'semver';

import { FileBrowser, getFileBrowserFromOptions, GetFileBrowserOptions } from './file-browser';
import { extractNodeEnvironmentVariablesFromFile, findDirsWithPackageDependency, getGatsbySourceFilesystemOptions } from './analyzer-utils';
import { Config } from '../config/config-types';

export type SSGMatcherOptions = GetFileBrowserOptions;

type AssetsReferenceType = 'static' | 'relative';

export interface SSGMatchResult {
    ssgName: Config['ssgName'];
    ssgDir?: string;
    isTheme?: boolean;
    publishDir?: string;
    staticDir?: string;
    pagesDir?: string;
    dataDir?: string;
    contentDirs?: string[];
    envVars?: string[];
    nodeVersion?: string;
    pageTypeKey?: string;
    assetsReferenceType?: AssetsReferenceType;
    options?: {
        ssgDirs?: string[];
    };
}

type SSGMatchPartialResult = Omit<SSGMatchResult, 'ssgName'>;

export async function matchSSG(options: SSGMatcherOptions): Promise<SSGMatchResult | null> {
    const fileBrowser = getFileBrowserFromOptions(options);
    await fileBrowser.listFiles();
    return getFirstMatchedSSG(fileBrowser);
}

async function getFirstMatchedSSG(fileBrowser: FileBrowser): Promise<SSGMatchResult | null> {
    let partialMatch = null;
    let ssgMatcher = null;
    for (ssgMatcher of SSGMatchers) {
        if (ssgMatcher.match) {
            partialMatch = await ssgMatcher.match(fileBrowser!);
        } else if (ssgMatcher.matchByPackageName) {
            partialMatch = await matchSSGByPackageName(fileBrowser!, ssgMatcher.matchByPackageName);
        }
        if (partialMatch) {
            break;
        }
    }
    if (!partialMatch || !ssgMatcher) {
        return null;
    }
    if (partialMatch.nodeVersion === undefined && ssgMatcher.matchNodeVersion) {
        const nodeVersion = await matchNodeVersion(fileBrowser, partialMatch);
        if (nodeVersion) {
            partialMatch.nodeVersion = nodeVersion;
        } else {
            partialMatch.nodeVersion = '12';
        }
    }
    return {
        ssgName: ssgMatcher.name,
        ..._.pick(ssgMatcher, ['publishDir', 'staticDir', 'pageTypeKey', 'assetsReferenceType']),
        ...partialMatch
    };
}

async function matchSSGByPackageName(fileBrowser: FileBrowser, packageName: string): Promise<SSGMatchPartialResult | null> {
    const dirs = await findDirsWithPackageDependency(fileBrowser, [packageName]);
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

async function matchNodeVersion(fileBrowser: FileBrowser, partialMatch: SSGMatchPartialResult): Promise<string | null> {
    if (partialMatch.ssgDir === undefined) {
        return null;
    }
    const packageJsonPath = path.join(partialMatch.ssgDir, 'package.json');
    const packageJsonData = await fileBrowser.getFileData(packageJsonPath);
    if (packageJsonData) {
        const nodeVerRange = _.get(packageJsonData, 'engines.node');
        if (nodeVerRange && semver.validRange(nodeVerRange)) {
            const minNodeVersion = semver.minVersion(nodeVerRange);
            return minNodeVersion ? String(minNodeVersion.major) : null;
        }
    }
    const nvmrcPath = path.join(partialMatch.ssgDir, '.nvmrc');
    const nvmrcData = await fileBrowser.getFileData(nvmrcPath);
    if (nvmrcData && semver.validRange(nvmrcData)) {
        const minNodeVersion = semver.minVersion(nvmrcData);
        return minNodeVersion ? String(minNodeVersion.major) : null;
    }
    return null;
}

interface SSGMatcher {
    name: Config['ssgName'];
    matchByPackageName?: string;
    matchNodeVersion?: boolean;
    publishDir?: string;
    staticDir?: string;
    assetsReferenceType?: AssetsReferenceType;
    pageTypeKey?: string;
    match?: (fileBrowser: FileBrowser) => Promise<SSGMatchPartialResult | null>;
}

const SSGMatchers: SSGMatcher[] = [
    {
        name: 'gatsby',
        publishDir: 'public',
        staticDir: 'static',
        matchNodeVersion: false,
        match: async (fileBrowser) => {
            const partialMatch = await matchSSGByPackageName(fileBrowser, 'gatsby');
            if (!partialMatch || partialMatch.ssgDir === undefined) {
                return partialMatch;
            }
            const gatsbyConfigPath = path.join(partialMatch.ssgDir, 'gatsby-config.js');
            const configData = await fileBrowser.getFileData(gatsbyConfigPath);
            if (configData && typeof configData === 'string') {
                // extract env vars from gatsby config
                const envVars = await extractNodeEnvironmentVariablesFromFile(configData);
                if (!_.isEmpty(envVars)) {
                    partialMatch.envVars = envVars;
                }

                // extract gatsby-source-filesystem paths
                const gatsbySourceFilesystemOptions = getGatsbySourceFilesystemOptions(configData);
                partialMatch.contentDirs = _.map(gatsbySourceFilesystemOptions, 'path');
            }

            // find node version
            const nodeVesion = await matchNodeVersion(fileBrowser, partialMatch);
            if (nodeVesion) {
                partialMatch.nodeVersion = nodeVesion;
            } else {
                const packageJsonPath = path.join(partialMatch.ssgDir, 'package.json');
                const packageJsonData = await fileBrowser.getFileData(packageJsonPath);
                const gatsbyVersion = semver.coerce(_.get(packageJsonData, ['dependencies', 'gatsby']));
                if (gatsbyVersion && semver.satisfies(gatsbyVersion, '>=3.x')) {
                    partialMatch.nodeVersion = '12';
                }
            }

            return partialMatch;
        }
    },
    {
        name: 'nextjs',
        publishDir: 'out',
        staticDir: 'static',
        matchNodeVersion: true,
        matchByPackageName: 'next'
    },
    {
        name: 'hexo',
        publishDir: 'public',
        matchNodeVersion: true,
        matchByPackageName: 'hexo'
    },
    {
        name: 'eleventy',
        // TODO: publishDir can be changed in 11ty config, read it from there
        publishDir: '_site',
        pageTypeKey: 'layout',
        matchNodeVersion: true,
        matchByPackageName: '@11ty/eleventy'
    },
    {
        name: 'vuepress',
        matchNodeVersion: true,
        matchByPackageName: 'vuepress'
    },
    {
        name: 'gridsome',
        matchNodeVersion: true,
        matchByPackageName: 'gridsome'
    },
    {
        name: 'nuxt',
        matchNodeVersion: true,
        matchByPackageName: 'nuxt'
    },
    {
        name: 'sapper',
        matchNodeVersion: true,
        matchByPackageName: 'sapper'
    },
    {
        name: 'hugo',
        pageTypeKey: 'layout',
        assetsReferenceType: 'static',
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
                staticDir: 'static',
                publishDir: 'public'
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
                staticDir: dirMap.staticDir,
                publishDir: dirMap.publishDir
            };
        }
    },
    {
        name: 'jekyll',
        pageTypeKey: 'layout',
        assetsReferenceType: 'static',
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
                includes_dir: '_includes',
                destination: '_site'
            };
            if (configFilePath) {
                const configData = fileBrowser.getFileData(configFilePath);
                _.assign(dirMap, _.pick(configData, _.keys(dirMap)));
            }
            const match = {
                ssgDir: '',
                isTheme: hasGemspecWithJekyll,
                pagesDir: dirMap.source,
                dataDir: dirMap.data_dir,
                staticDir: dirMap.source,
                publishDir: dirMap.destination
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
