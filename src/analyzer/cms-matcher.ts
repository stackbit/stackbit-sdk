import path from 'path';
import _ from 'lodash';
import { forEachPromise, reducePromise } from '@stackbit/utils';

import { FileBrowser, FileBrowserAdapterInterface } from './file-browser';
import { findDirsWithPackageDependency } from './analyzer-utils';
import { Config } from '../config/config-loader';

export interface CMSMatcherOptions {
    fileBrowserAdapter?: FileBrowserAdapterInterface;
    fileBrowser?: FileBrowser;
}

export interface CMSMatchResult {
    cmsName: Config['cmsName'];
    cmsDir?: string;
    cmsProjectId?: string;
    cmsEnvironmentName?: string;
    options?: {
        cmsDirs?: string[];
    };
}

export async function matchCMS({ fileBrowser, fileBrowserAdapter }: CMSMatcherOptions): Promise<CMSMatchResult | null> {
    if (!fileBrowser) {
        if (!fileBrowserAdapter) {
            throw new Error('either fileBrowser or fileBrowserAdapter must be provided to CSS matcher');
        }
        fileBrowser = new FileBrowser({ fileBrowserAdapter });
    }
    await fileBrowser.listFiles();
    let cssMatch: CMSMatchResult | null = null;
    await forEachPromise(CSSMatchers, async (cssMatcher: CSSMatcher) => {
        if (cssMatcher.match) {
            const partialMatch = await cssMatcher.match(fileBrowser!);
            if (partialMatch) {
                cssMatch = {
                    cmsName: cssMatcher.name,
                    ...partialMatch
                };
                return false;
            }
        } else if (cssMatcher.matchByPackageName) {
            const dirs = await findDirsWithPackageDependency(fileBrowser!, cssMatcher.matchByPackageName);
            if (dirs.length === 1) {
                cssMatch = {
                    cmsName: cssMatcher.name,
                    cmsDir: dirs[0]
                };
                return false;
            } else if (dirs.length > 1) {
                cssMatch = {
                    cmsName: cssMatcher.name,
                    options: {
                        cmsDirs: dirs
                    }
                };
                return false;
            }
        }
    });
    return cssMatch;
}

interface CSSMatcher {
    name: Config['cmsName'];
    matchByPackageName?: string;
    match?: (fileBrowser: FileBrowser) => Promise<Omit<CMSMatchResult, 'cmsName'> | null>;
}

const CSSMatchers: CSSMatcher[] = [
    {
        name: 'contentful',
        matchByPackageName: 'gatsby-source-contentful'
    },
    {
        name: 'sanity',
        match: async (fileBrowser) => {
            const configFile = 'sanity.json';
            const configFileExists = fileBrowser.fileNameExists(configFile);
            if (!configFileExists) {
                return null;
            }
            const configFilePaths = fileBrowser.getFilePathsForFileName(configFile);
            const dirs = _.map(configFilePaths, (filePath) => path.parse(filePath).dir);
            if (dirs.length === 1) {
                const config = await fileBrowser.getFileData(configFilePaths[0]!);
                return _.omitBy(
                    {
                        cmsDir: dirs[0],
                        cmsProjectId: _.get(config, 'api.projectId'),
                        cmsEnvironmentName: _.get(config, 'api.dataset')
                    },
                    _.isNil
                );
            } else if (dirs.length > 1) {
                return {
                    options: {
                        cmsDirs: dirs
                    }
                };
            }
            return null;
        }
    },
    {
        name: 'forestry',
        match: async (fileBrowser) => {
            const configFolder = '.forestry';
            const configFolderExists = fileBrowser.directoryPathExists(configFolder);
            if (!configFolderExists) {
                return null;
            }
            return {
                cmsDir: ''
            };
        }
    },
    {
        name: 'netlifycms',
        match: async (fileBrowser) => {
            const configFile = 'config.yml';
            const configFileExists = fileBrowser.fileNameExists(configFile);
            if (!configFileExists) {
                return null;
            }
            const configFilePaths = fileBrowser.getFilePathsForFileName(configFile);
            const netlifyCMSConfigFilePaths = await reducePromise(
                configFilePaths,
                async (filePaths: string[], filePath: string) => {
                    const data = await fileBrowser.getFileData(filePath);
                    const hasBackend = _.has(data, 'backend');
                    if (!hasBackend) {
                        return filePaths;
                    }
                    const requiredFields = ['backend', 'media_folder', 'collections'];
                    const minNumOfRequiredFields = 2;
                    const numOfRequiredFields = _.reduce(requiredFields, (count, field) => count + (_.has(data, field) ? 1 : 0), 0);
                    if (numOfRequiredFields < minNumOfRequiredFields) {
                        return filePaths;
                    }
                    return filePaths.concat(filePath);
                },
                []
            );
            const dirs = _.map(netlifyCMSConfigFilePaths, (filePath) => path.parse(filePath).dir);
            if (dirs.length === 1) {
                return {
                    cmsDir: dirs[0]
                };
            } else if (dirs.length > 1) {
                return {
                    options: {
                        cmsDirs: dirs
                    }
                };
            }
            return null;
        }
    }
];
