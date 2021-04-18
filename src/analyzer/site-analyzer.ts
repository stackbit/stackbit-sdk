import _ from 'lodash';

import { getFileBrowserFromOptions, GetFileBrowserOptions } from './file-browser';
import { matchSSG, SSGMatchResult } from './ssg-matcher';
import { CMSMatchResult, matchCMS } from './cms-matcher';
import { Config } from '../config/config-loader';
import { generateSchema, SchemaGeneratorResult } from './schema-generator';

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
    if (ssgMatchResult && !cmsMatchResult) {
        schemaGeneratorResult = await generateSchema({ ssgMatchResult, fileBrowser });
    }

    const dataDir = ssgMatchResult?.dataDir !== undefined ? ssgMatchResult.dataDir : schemaGeneratorResult?.dataDir;
    const pagesDir = ssgMatchResult?.pagesDir !== undefined ? ssgMatchResult.pagesDir : schemaGeneratorResult?.pagesDir;

    let config: Config = {
        stackbitVersion: '~0.3.0',
        ssgName: ssgMatchResult?.ssgName,
        cmsName: cmsMatchResult?.cmsName,
        nodeVersion: ssgMatchResult?.nodeVersion,
        publishDir: ssgMatchResult?.publishDir,
        dataDir: dataDir,
        pagesDir: pagesDir,
        models: schemaGeneratorResult?.models || []
    };

    config = _.omitBy(config, _.isUndefined) as Config;

    return {
        ssgMatchResult,
        cmsMatchResult,
        config
    };
}
