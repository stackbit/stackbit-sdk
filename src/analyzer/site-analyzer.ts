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
    if (ssgMatchResult) {
        schemaGeneratorResult = await generateSchema({ ssgMatchResult, fileBrowser });
    }

    let config: Config = {
        stackbitVersion: '~0.3.0',
        ssgName: ssgMatchResult?.ssgName,
        cmsName: cmsMatchResult?.cmsName,
        publishDir: ssgMatchResult?.publishDir,
        dataDir: ssgMatchResult?.dataDir,
        pagesDir: ssgMatchResult?.pagesDir,
        models: schemaGeneratorResult?.models || []
    };

    config = _.omitBy(config, _.isNil) as Config;

    return {
        ssgMatchResult,
        cmsMatchResult,
        config
    };
}
