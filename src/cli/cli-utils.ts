import _ from 'lodash';
import { Config, loadConfig } from '../config/config-loader';
import { loadContent } from '../content/content-loader';
import { ContentValidationError } from '../content/content-errors';

export async function validate({ inputDir, configOnly }: { inputDir: string; configOnly: boolean }) {
    console.log(`validating stackbit configuration at ${inputDir}`);
    const result = await loadConfig({
        dirPath: inputDir
    });
    if (result.errors.length === 0) {
        console.log('configuration is valid');
    } else {
        console.group(`found ${result.errors.length} errors in configuration:`);
        result.errors.forEach((error) => {
            console.log(error.message);
        });
        console.groupEnd();
    }
    if (!configOnly && result.config) {
        await validateContent({
            dirPath: inputDir,
            config: result.config,
            skipUnmodeledContent: false
        });
    }
}

interface ValidateContentOptions {
    dirPath: string;
    config: Config;
    skipUnmodeledContent: boolean;
}

export async function validateContent({ dirPath, config, skipUnmodeledContent }: ValidateContentOptions) {
    console.log(`loading content from ${dirPath}`);
    const result = await loadContent({ dirPath, config, skipUnmodeledContent });
    console.group(`loaded ${result.contentItems.length} files`);
    const { modeledItems, unmodeledItems } = _.groupBy(result.contentItems, (contentItem) =>
        contentItem.__metadata.modelName !== null ? 'modeledItems' : 'unmodeledItems'
    );
    if (typeof modeledItems !== 'undefined' && modeledItems.length > 0) {
        const modeledItemsByModelName = _.groupBy(modeledItems, (contentItem) => {
            return contentItem.__metadata.modelName;
        });
        console.group(`${modeledItems.length} files matched to models:`)
        _.forEach(modeledItemsByModelName, (contentItems, modelName) => {
            console.group(`${modelName}: ${contentItems.length} files:`);
            _.forEach(contentItems, contentItem => {
                console.log(contentItem.__metadata.filePath);
            });
            console.groupEnd();
        });
    }
    if (typeof unmodeledItems !== 'undefined' && unmodeledItems.length > 0) {
        console.group(`${unmodeledItems.length} files could not be matched to models:`)
        _.forEach(unmodeledItems, contentItem => {
            console.log(contentItem.__metadata.filePath);
        });
        console.groupEnd();
    }
    console.groupEnd();
    if (result.errors.length === 0) {
        console.log('content is valid');
    } else {
        console.group(`found ${result.errors.length} errors in content:`);
        result.errors.forEach((error) => {
            if (error instanceof ContentValidationError) {
                console.log(`${error.filePath} (${error.modelName}): ${error.message}`);
            } else {
                console.log(error.message);
            }
        });
        console.groupEnd();
    }
    return result;
}
