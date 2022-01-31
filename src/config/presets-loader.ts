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
        const files = (await fse.readdir(presetsDir))
            .filter((fileName) => ['.json', '.yaml', '.yml'].includes(path.parse(fileName).ext))
            .map((fileName) => path.join(presetsRelDir, fileName));
        presetFiles.push(...files);
    }

    const presets: Record<string, any> = {};
    const presetsIdsByModel: Record<string, any> = {};
    const errors: ConfigPresetsError[] = [];

    for (const presetFile of presetFiles) {
        const presetsRelDir = path.dirname(presetFile);
        const presetPath = path.join(dirPath, presetFile);
        let presetData: any;
        try {
            presetData = await parseFile(presetPath);
        } catch (err: any) {
            errors.push(new ConfigPresetsError(`Error parsing ${presetFile} (${err?.message})`));
            continue;
        }
        _.forEach(_.get(presetData, 'presets', []), (preset, i) => {
            const presetId = `${presetFile}:presets[${i}]`;
            presets[presetId] = preset;
            if (preset.thumbnail) {
                preset.thumbnail = resolveThumbnailPath(preset.thumbnail, presetsRelDir);
            }
            _.set(preset, 'modelName', presetData.model);
            append(presetsIdsByModel, presetData.model, presetId);
        });
    }

    // update models with presets IDs
    const models = _.map(config.models, (model) => {
        const presetIdsForModel = presetsIdsByModel[model.name];
        if (!presetIdsForModel) {
            return model;
        }
        return { ...model, presets: presetIdsForModel };
    });

    return {
        config: Object.assign({}, config, {
            models,
            presets
        }),
        errors
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
