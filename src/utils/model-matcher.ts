import micromatch from 'micromatch';
import _ from 'lodash';

import { FileMatchedMultipleModelsError, FileNotMatchedModelError } from '../content/content-errors';
import { Model } from '../config/config-types';

interface BaseModelQuery {
    filePath: string;
}

interface TypedModelQuery extends BaseModelQuery {
    type: string | null;
    modelTypeKeyPath: string | string[];
}

type ModelQuery = BaseModelQuery | TypedModelQuery;

/**
 * Returns a single model matching the `query` describing a content file.
 * @see `getModelsByQuery()` for more info.
 *
 * @param {Object} query A query object to match a model against.
 * @param {string} query.filePath The path of the content file relative to the `pagesDir` or `dataDir` folders defined in stackbit.yaml.
 * @param {string} [query.type] The type of the data file. For example, can be page's layout that maps to page's model.
 * @param {Array|string} [query.modelTypeKeyPath] Used to compare the value of `query.type` with the value of a model at `modelTypeKeyPath`.
 *   Required if `query.type` is provided.
 * @param {Array.<Object>} models Array of stackbit.yaml `models`.
 * @return {Object} stackbit.yaml model matching the `query`.
 */
export function getModelByQuery(query: ModelQuery, models: Model[]): { model: Model | null; error: Error | null } {
    const matchedModels = getModelsByQuery(query, models);
    const filePath = _.get(query, 'filePath');
    if (matchedModels.length === 0) {
        return { model: null, error: new FileNotMatchedModelError({ filePath: filePath }) };
    } else if (matchedModels.length > 1) {
        return { model: null, error: new FileMatchedMultipleModelsError({ filePath: filePath, modelNames: _.map(matchedModels, 'name') }) };
    }
    return { model: matchedModels[0]!, error: null };
}

/**
 * Returns an array of models matching the `query` describing a content file.
 *
 * The `query` object is required to have the `filePath` property which is the path
 * of the content file relative to the `pagesDir` or `dataDir` folders defined
 * in stackbit.yaml.
 *
 * The `query` object might also contain the `type` and `modelTypeKeyPath`
 * properties. When these properties provided, the value of the `type` is
 * compared against the value of a model located at the path specified by
 * `modelTypeKeyPath`. This is useful, when a folder might contain objects of
 * different model types.
 *
 * @param {Object} query A query object to match models against.
 * @param {string} query.filePath The path of the content file relative to the `pagesDir` or `dataDir` folders defined in stackbit.yaml.
 * @param {string} [query.type] The type of the data file. For example, can be page's layout that maps to page's model.
 * @param {Array|string} [query.modelTypeKeyPath] Used to compare the value of `query.type` with the value of a model at `modelTypeKeyPath`.
 *   Required if `query.type` is provided.
 * @param {Array.<Object>} models Array of stackbit.yaml `models`.
 * @return {Array.<Model>} Array of stackbit.yaml models matching the `query`.
 */
export function getModelsByQuery(query: ModelQuery, models: Model[]): Model[] {
    const filePath = _.get(query, 'filePath');
    const objectType = _.get(query, 'type');
    const modelTypeKeyPath = _.get(query, 'modelTypeKeyPath');

    const modelMatchGroups = _.reduce(
        models,
        (
            modelGroups: {
                byFile: Model[];
                byType: Model[];
                byGlob: Model[];
            },
            model
        ) => {
            if (_.has(model, 'file')) {
                modelGroups.byFile.push(model);
            } else if (objectType && _.has(model, modelTypeKeyPath)) {
                modelGroups.byType.push(model);
            } else {
                modelGroups.byGlob.push(model);
            }
            return modelGroups;
        },
        {
            byFile: [],
            byType: [],
            byGlob: []
        }
    );

    const fileMatchedModels = _.filter(modelMatchGroups.byFile, (model) => {
        if (!_.isString(model.file)) {
            return false;
        }
        try {
            return micromatch.isMatch(filePath, model.file);
        } catch (error) {
            return false;
        }
    });

    if (!_.isEmpty(fileMatchedModels)) {
        return fileMatchedModels;
    }

    const typeMatchedModels = _.filter(modelMatchGroups.byType, (model) => {
        const modelType = _.get(model, modelTypeKeyPath);
        return objectType === modelType;
    });

    if (!_.isEmpty(typeMatchedModels)) {
        return typeMatchedModels;
    }

    return _.filter(modelMatchGroups.byGlob, (model) => {
        const folder = _.get(model, 'folder', '');
        let match = _.get(model, 'match', '**/*');
        let exclude = _.get(model, 'exclude', []);
        match = joinPathAndGlob(folder, match);
        exclude = joinPathAndGlob(folder, exclude);
        return micromatch.isMatch(filePath, match) && (_.isEmpty(exclude) || !micromatch.isMatch(filePath, exclude));
    });
}

function joinPathAndGlob(pathStr: string, glob: string | string[]) {
    glob = globToArray(glob);
    return _.map(glob, (globPart) => _.compact([pathStr, globPart]).join('/'));
}

function globToArray(glob: string | string[]) {
    return _.chain(glob)
        .castArray()
        .compact()
        .reduce((accum: string[], globPart) => {
            const globParts = _.chain(globPart).trim('{}').split(',').compact().value();
            return _.concat(accum, globParts);
        }, [])
        .value();
}
