import _ from 'lodash';

import { getFileBrowserFromOptions, GetFileBrowserOptions } from './file-browser';
import { matchSSG, SSGMatchResult } from './ssg-matcher';
import { CMSMatchResult, matchCMS } from './cms-matcher';
import { generateSchema, SchemaGeneratorResult } from './schema-generator';
import { Assets, Config } from '../config/config-types';

export type SiteAnalyzerOptions = GetFileBrowserOptions;

export interface SiteAnalyzerResult {
    ssgMatchResult: SSGMatchResult | null;
    cmsMatchResult: CMSMatchResult | null;
    config: Config;
}

export async function analyzeSite(options: SiteAnalyzerOptions): Promise<SiteAnalyzerResult> {
    const fileBrowser = getFileBrowserFromOptions(options);

    const ssgMatchResult = await matchSSG({ fileBrowser });
    const cmsMatchResult = await matchCMS({ fileBrowser });
    let schemaGeneratorResult: SchemaGeneratorResult | null = null;
    if (!cmsMatchResult) {
        schemaGeneratorResult = await generateSchema({ ssgMatchResult, fileBrowser });
    }

    const dataDir = ssgMatchResult?.dataDir !== undefined ? ssgMatchResult.dataDir : schemaGeneratorResult?.dataDir;
    const pagesDir = ssgMatchResult?.pagesDir !== undefined ? ssgMatchResult.pagesDir : schemaGeneratorResult?.pagesDir;

    const assets = generateAssets(ssgMatchResult);

    let config: Config = {
        stackbitVersion: '~0.3.0',
        ssgName: ssgMatchResult?.ssgName,
        cmsName: cmsMatchResult?.cmsName,
        nodeVersion: ssgMatchResult?.nodeVersion,
        publishDir: ssgMatchResult?.publishDir,
        dataDir: dataDir,
        pagesDir: pagesDir,
        assets: assets,
        models: schemaGeneratorResult?.models || []
    };

    config = _.omitBy(config, _.isUndefined) as Config;

    return {
        ssgMatchResult,
        cmsMatchResult,
        config
    };
}

function generateAssets(ssgMatchResult: SSGMatchResult | null): Assets | undefined {
    if (ssgMatchResult?.assetsReferenceType === 'static' && ssgMatchResult?.staticDir) {
        return {
            referenceType: 'static',
            staticDir: ssgMatchResult?.staticDir,
            uploadDir: 'assets',
            publicPath: '/'
        };
    }
    return undefined;
}
