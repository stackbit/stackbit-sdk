import path from 'path';
import _ from 'lodash';
import { reducePromise } from '@stackbit/utils';

import { FileBrowser } from './file-browser';

export async function findDirsWithPackageDependency(fileBrowser: FileBrowser, packageNames: string[]): Promise<string[]> {
    const fileName = 'package.json';

    const packageJsonExists = fileBrowser.fileNameExists(fileName);
    if (!packageJsonExists) {
        return [];
    }

    let filePaths = fileBrowser.getFilePathsForFileName(fileName);

    filePaths = await reducePromise(
        filePaths,
        async (filePaths: string[], filePath: string) => {
            const data = await fileBrowser.getFileData(filePath);
            const hasDependency = _.some(packageNames, (packageName) => _.has(data, ['dependencies', packageName]));
            const hasDevDependency = _.some(packageNames, (packageName) => _.has(data, ['devDependencies', packageName]));
            if (hasDependency || hasDevDependency) {
                filePaths.push(filePath);
            }
            return filePaths;
        },
        []
    );

    return _.map(filePaths, (filePath) => path.parse(filePath).dir);
}

export async function extractNodeEnvironmentVariablesFromFile(fileBrowser: FileBrowser, filePath: string): Promise<string[]> {
    const envVars: string[] = [];
    const data = await fileBrowser.getFileData(filePath);
    if (!data || typeof data !== 'string') {
        return envVars;
    }
    const envVarsRe = /process\.env\.(\w+)/g;
    let reResult;
    while ((reResult = envVarsRe.exec(data)) !== null) {
        envVars.push(reResult[1]!);
    }
    return _.uniq(envVars);
}
