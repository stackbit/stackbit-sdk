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
    console.log(`validating content at ${dirPath}`);
    const result = await loadContent({ dirPath, config, skipUnmodeledContent });
    if (result.errors.length === 0) {
        console.log('content is valid');
    } else {
        console.group(`found ${result.errors.length} errors in content:`);
        result.errors.forEach((error) => {
            if (error instanceof ContentValidationError) {
                console.log(error.filePath + ': ' + error.message);
            } else {
                console.log(error.message);
            }
        });
        console.groupEnd();
    }
    return result;
}
