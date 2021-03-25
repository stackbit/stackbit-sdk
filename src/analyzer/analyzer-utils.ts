import path from 'path';
import { reducePromise } from '@stackbit/utils';
import { FileBrowser } from './file-browser';
import _ from 'lodash';

export async function findDirsWithPackageDependency(fileBrowser: FileBrowser, packageName: string): Promise<string[]> {
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
            const hasDependency = _.has(data, ['dependencies', packageName]);
            const hasDevDependency = _.has(data, ['devDependencies', packageName]);
            if (hasDependency || hasDevDependency) {
                filePaths.push(filePath);
            }
            return filePaths;
        },
        []
    );

    return _.map(filePaths, (filePath) => path.parse(filePath).dir);
}
