import path from 'path';
import _ from 'lodash';
import { findPromise, forEachPromise, reducePromise } from '@stackbit/utils';

import { FileBrowser, getFileBrowserFromOptions, GetFileBrowserOptions } from './file-browser';
import { findDirsWithPackageDependency } from './analyzer-utils';
import { Config } from '../config/config-types';

export type CMSMatcherOptions = GetFileBrowserOptions;

type CmsName = NonNullable<Config['cmsName']>;

export interface CMSResultDataSanity {
    studioPath: string;
    projectId?: string;
    dataset?: string;
}

export interface CMSResultDataNetlifyCMS {
    configPath: string;
}

export interface CMSResultDataForestry {
    forestryDir: string;
    siteId?: string;
    ssoName?: string;
}

type CMSResultDataType = CMSResultDataSanity | CMSResultDataNetlifyCMS | CMSResultDataForestry;

export type CMSMatchResult = {
    cmsName: CmsName;
    cmsData?: CMSResultDataType;
};

export async function matchCMS(options: CMSMatcherOptions): Promise<CMSMatchResult | null> {
    const fileBrowser = getFileBrowserFromOptions(options);
    await fileBrowser.listFiles();
    let cssMatch: CMSMatchResult | null = null;
    await forEachPromise(CSSMatchers, async (cssMatcher: CSSMatcher) => {
        if (cssMatcher.match) {
            const cmsDataResult = await cssMatcher.match(fileBrowser!);
            if (cmsDataResult) {
                cssMatch = {
                    cmsName: cssMatcher.name,
                    cmsData: cmsDataResult
                };
                return false;
            }
        } else if (cssMatcher.matchByPackageName) {
            const dirs = await findDirsWithPackageDependency(fileBrowser!, _.castArray(cssMatcher.matchByPackageName));
            if (dirs.length === 1) {
                cssMatch = {
                    cmsName: cssMatcher.name
                };
                return false;
            }
        }
    });
    return cssMatch;
}

interface CSSMatcher {
    name: CmsName;
    matchByPackageName?: string | string[];
    match?: (fileBrowser: FileBrowser) => Promise<CMSResultDataType | null>;
}

const CSSMatchers: CSSMatcher[] = [
    {
        name: 'contentful',
        matchByPackageName: ['gatsby-source-contentful', 'sourcebit-source-contentful', 'contentful', 'contentful-management']
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
            const rootConfigPath = await findPromise(configFilePaths, async (configFilePath: string) => {
                const config = await fileBrowser.getFileData(configFilePath);
                return _.has(config, 'root') || _.has(config, 'api');
            });
            if (rootConfigPath) {
                const config = await fileBrowser.getFileData(rootConfigPath);
                return _.omitBy(
                    {
                        studioPath: path.parse(rootConfigPath).dir,
                        projectId: _.get(config, 'api.projectId'),
                        dataset: _.get(config, 'api.dataset')
                    },
                    _.isNil
                ) as CMSResultDataSanity;
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
                forestryDir: configFolder
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
            if (netlifyCMSConfigFilePaths.length === 1) {
                return {
                    configPath: netlifyCMSConfigFilePaths[0]!
                };
            }
            return null;
        }
    }
];
