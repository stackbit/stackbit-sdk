import path from 'path';
import micromatch from 'micromatch';

import { FileBrowser, FileResult, getFileBrowserFromOptions, GetFileBrowserOptions } from './file-browser';
import { SSGMatchResult } from './ssg-matcher';
import { DATA_FILE_EXTENSIONS, EXCLUDED_DATA_FILES, EXCLUDED_MARKDOWN_FILES, GLOBAL_EXCLUDES, MARKDOWN_FILE_EXTENSIONS } from '../consts';
import { Model } from '../config/config-loader';

export type SchemaGeneratorOptions = {
    ssgMatchResult: SSGMatchResult;
} & GetFileBrowserOptions;

export interface SchemaGeneratorResult {
    models: Model[];
}

export async function generateSchema({ ssgMatchResult, ...fileBrowserOptions }: SchemaGeneratorOptions): Promise<SchemaGeneratorResult | null> {
    const fileBrowser = getFileBrowserFromOptions(fileBrowserOptions);
    await fileBrowser.listFiles();

    let schemaResult: SchemaGeneratorResult | null = null;

    const ssgDir = ssgMatchResult.ssgDir ?? '';
    const pagesDir = ssgMatchResult.pagesDir ?? '';
    const dataDir = ssgMatchResult.dataDir ?? '';
    const fullPagesDir = path.join(ssgDir, pagesDir);
    const fullDataDir = path.join(ssgDir, dataDir);

    const excludedPageFiles = [...GLOBAL_EXCLUDES, ...EXCLUDED_MARKDOWN_FILES];
    const excludedDataFiles = ['config.*', '_config.*', ...GLOBAL_EXCLUDES, ...EXCLUDED_DATA_FILES];
    if (ssgMatchResult.publishDir) {
        excludedPageFiles.push(ssgMatchResult.publishDir);
        excludedDataFiles.push(ssgMatchResult.publishDir);
    }

    const pageFiles = await readDirRecursivelyWithFilter(fileBrowser, fullPagesDir, excludedPageFiles, MARKDOWN_FILE_EXTENSIONS);
    const dataFiles = await readDirRecursivelyWithFilter(fileBrowser, fullDataDir, excludedDataFiles, DATA_FILE_EXTENSIONS);

    return schemaResult;
}

async function readDirRecursivelyWithFilter(fileBrowser: FileBrowser, dirPath: string, excludedFiles: string[], allowedExtensions: string[]) {
    return fileBrowser.readFilesRecursively(dirPath, {
        filter: (fileResult: FileResult) => {
            if (micromatch.isMatch(fileResult.filePath, excludedFiles)) {
                return false;
            }
            if (fileResult.isDirectory) {
                return true;
            }
            const extension = path.extname(fileResult.filePath).substring(1);
            return allowedExtensions.includes(extension);
        }
    });
}
