import path from 'path';
import fse from 'fs-extra';
import yaml from 'js-yaml';
import _ from 'lodash';

import { Config, Model } from './config-loader';
import { YamlConfig, YamlModel, YamlModels } from './config-schema';

export interface WriteConfigOptions {
    dirPath: string;
    config: Config;
}

export async function writeConfig({ dirPath, config }: WriteConfigOptions) {
    const yamlConfig = convertToYamlConfig({ config });
    const filePath = path.join(dirPath, 'stackbit.yaml');
    await fse.outputFile(filePath, yaml.dump(yamlConfig));
}

export function convertToYamlConfig({ config }: { config: Config }): YamlConfig {
    const yamlConfig: YamlConfig = _.cloneDeep(_.omit(config, 'models'));
    if (!_.isEmpty(config.models)) {
        yamlConfig.models = _.reduce(
            config.models,
            (yamlModels: YamlModels, model: Model) => {
                const yamlModel = _.omit(model, ['name', '__metadata']) as YamlModel;
                if (yamlModel.type === 'page' && !yamlModel.hideContent && yamlModel.fields) {
                    _.remove(yamlModel.fields, (field) => field.name === 'markdown_content');
                }
                yamlModels[model.name] = yamlModel;
                return yamlModels;
            },
            {}
        );
    }
    return yamlConfig;
}
