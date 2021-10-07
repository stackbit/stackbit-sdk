import _ from 'lodash';
import path from 'path';
import fse from 'fs-extra';
import { parseFile, append } from '@stackbit/utils';

import { Config } from './config-types';
import { ConfigPresetsError } from './config-errors';

export interface PresetsLoaderResult {
    config: Config;
    errors: ConfigPresetsError[];
}

export async function loadPresets(dirPath: string, config: Config): Promise<PresetsLoaderResult> {
    const presetFiles = [];
    const presetsRelDirs = ['.stackbit/presets', 'node_modules/@stackbit/components/presets'];

    for (const presetsRelDir of presetsRelDirs) {
        const presetsDir = path.join(dirPath, presetsRelDir);
        if (!(await fse.pathExists(presetsDir))) {
            continue;
        }
        presetFiles.push(
            ...(await fse.readdir(presetsDir)).filter((fileName) => path.parse(fileName).ext === '.json').map((fileName) => path.join(presetsRelDir, fileName))
        );
    }

    const presets: any = {};
    const presetsByModel: any = {};

    for (const presetFile of presetFiles) {
        const presetsRelDir = path.dirname(presetFile);
        const presetPath = path.join(dirPath, presetFile);
        const presetData = await parseFile(presetPath);
        _.forEach(_.get(presetData, 'presets', []), (preset, i) => {
            const presetId = `${presetFile}:presets[${i}]`;
            presets[presetId] = preset;
            if (preset.thumbnail) {
                preset.thumbnail = resolveThumbnailPath(preset.thumbnail, presetsRelDir);
            }
            append(presetsByModel, presetData.model, presetId);
        });
    }

    // update config with presets
    for (const model of config.models) {
        const presetsForModel = presetsByModel[model.name];
        if (presetsForModel) {
            model.presets = presetsForModel;
        }
    }

    config.presets = presets;

    return {
        config,
        errors: []
    };
}

function resolveThumbnailPath(thumbnail: string, dir: string) {
    if (thumbnail.startsWith('/')) {
        if (dir.endsWith('@stackbit/components/presets')) {
            dir = dir.replace(/\/presets$/, '');
        } else {
            dir = '';
        }
        thumbnail = thumbnail.replace(/^\//, '');
    }
    return path.join(dir, thumbnail);
}
