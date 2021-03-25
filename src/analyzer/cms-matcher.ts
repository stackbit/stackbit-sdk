import { FileBrowser, FileBrowserAdapterInterface } from './file-browser';
import { SSGMatchResult } from './ssg-matcher';

interface CMSMatcherOptions {
    ssgMatchResult: SSGMatchResult;
    fileBrowserAdapter: FileBrowserAdapterInterface;
}

interface CMSMatchResult {
    cmsName: string;
}

export async function matchCMS({ ssgMatchResult, fileBrowserAdapter }: CMSMatcherOptions): Promise<CMSMatchResult | null> {
    const fileBrowser = new FileBrowser({ fileBrowserAdapter });
    return null;
}
