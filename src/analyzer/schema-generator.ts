import path from 'path';
import _ from 'lodash';
import micromatch from 'micromatch';
import moment from 'moment';
import { append } from '@stackbit/utils';

import { FileBrowser, FileResult, getFileBrowserFromOptions, GetFileBrowserOptions } from './file-browser';
import { SSGMatchResult } from './ssg-matcher';
import { DATA_FILE_EXTENSIONS, EXCLUDED_DATA_FILES, EXCLUDED_MARKDOWN_FILES, EXCLUDED_COMMON_FILES, MARKDOWN_FILE_EXTENSIONS } from '../consts';
import { DataModel, Model, ObjectModel, PageModel } from '../config/config-loader';
import { Field, FieldType, FieldListItems, FieldModelProps } from '../config/config-schema';
import {
    FieldListItemsWithUnknown,
    FieldListPropsWithUnknown,
    FieldPartialPropsWithUnknown,
    FieldTypeWithUnknown,
    FieldWithUnknown
} from './analyze-schema-types';

type FieldPath = (string | number)[];
type StringFieldTypes = Exclude<FieldType, 'number' | 'boolean' | 'enum' | 'object' | 'model' | 'reference' | 'list'>;
type PartialObjectModel = Omit<ObjectModel, 'label' | 'fields'> & { fields: FieldWithUnknown[]; refFieldPaths?: FieldPath[]; refFields?: FieldModelProps[] };
type PartialPageModel = Omit<PageModel, 'label' | 'fields'> & { fields: FieldWithUnknown[]; filePaths: string[] };
type PartialPageModelWithFilePaths = Omit<PageModel, 'label'> & { filePaths: string[] };
type PartialDataModel = Omit<DataModel, 'label' | 'fields' | 'items'> & { fields?: FieldWithUnknown[]; items?: FieldListItemsWithUnknown; filePaths: string[] };
type PartialModel = PartialPageModel | PartialDataModel;

const SAME_FOLDER_PAGE_DSC_COEFFICIENT = 0.6;
const ROOT_FOLDER_PAGE_DSC_COEFFICIENT = 0.7;
const DIFF_FOLDER_PAGE_DSC_COEFFICIENT = 0.8;
const DATA_MODEL_DSC_COEFFICIENT = 0.8;
const LIST_OBJECT_DSC_COEFFICIENT = 0.8;

export type SchemaGeneratorOptions = {
    ssgMatchResult: SSGMatchResult | null;
} & GetFileBrowserOptions;

export interface SchemaGeneratorResult {
    models: Model[];
    pagesDir?: string | null;
    dataDir?: string | null;
}

export async function generateSchema({ ssgMatchResult, ...fileBrowserOptions }: SchemaGeneratorOptions): Promise<SchemaGeneratorResult> {
    const fileBrowser = getFileBrowserFromOptions(fileBrowserOptions);
    await fileBrowser.listFiles();

    const ssgDir = ssgMatchResult?.ssgDir ?? '';
    const rootPagesDir = getDir(ssgDir, ssgMatchResult?.pagesDir ?? '');
    const rootDataDir = getDir(ssgDir, ssgMatchResult?.dataDir ?? '');

    const excludedPageFiles = getExcludedPageFiles(rootPagesDir, ssgMatchResult);
    const excludedDataFiles = getExcludedDataFiles(rootDataDir, ssgMatchResult);

    // TODO: in some projects, pages can be defined as JSON files as well
    const pageFiles = await readDirRecursivelyWithFilter(fileBrowser, rootPagesDir, excludedPageFiles, MARKDOWN_FILE_EXTENSIONS);
    const dataFiles = await readDirRecursivelyWithFilter(fileBrowser, rootDataDir, excludedDataFiles, DATA_FILE_EXTENSIONS);

    const pageModelsResults = await generatePageModelsForFiles({
        filePaths: pageFiles,
        dirPath: rootPagesDir,
        fileBrowser: fileBrowser,
        pageTypeKey: ssgMatchResult?.pageTypeKey,
        objectModels: []
    });
    const dataModelsResults = await generateDataModelsForFiles({
        filePaths: dataFiles,
        dirPath: rootDataDir,
        fileBrowser: fileBrowser,
        objectModels: pageModelsResults.objectModels
    });

    let pageModels = analyzePageFileMatchingProperties(pageModelsResults.pageModels);
    let dataModels = analyzeDataFileMatchingProperties(dataModelsResults.dataModels);

    let pagesDir = ssgMatchResult?.pagesDir;
    if (pagesDir === undefined && pageModels.length > 0) {
        const result = extractLowestCommonAncestorFolderFromModels(pageModels);
        pagesDir = getDir(ssgDir, result.commonDir);
        pageModels = result.models;
    }
    let dataDir = ssgMatchResult?.dataDir;
    if (dataDir === undefined && dataModels.length > 0) {
        const result = extractLowestCommonAncestorFolderFromModels(dataModels);
        dataDir = getDir(ssgDir, result.commonDir);
        dataModels = result.models;
    }

    const objectModels: ObjectModel[] = _.map(
        dataModelsResults.objectModels,
        (objectModel, index): ObjectModel => {
            const modelName = `object_${index + 1}`;
            return {
                type: 'object',
                name: objectModel.name,
                label: _.startCase(modelName),
                fields: removeUnknownTypesFromFields(objectModel.fields)
            };
        }
    );

    const models = _.concat<Model>(pageModels, dataModels, objectModels);

    return {
        models: models,
        pagesDir: pagesDir,
        dataDir: dataDir
    };
}

function getDir(ssgDir: string, contentDir: string) {
    const fullDir = path.join(ssgDir, contentDir);
    return fullDir === '.' ? '' : fullDir;
}

function getExcludedPageFiles(rootPagesDir: string, ssgMatchResult: SSGMatchResult | null): string[] {
    const excludedPageFiles = [...EXCLUDED_COMMON_FILES, ...EXCLUDED_MARKDOWN_FILES];
    if (rootPagesDir === '') {
        // if pagesDir wasn't specifically set to empty string, ignore content files in the root folder
        if (ssgMatchResult?.pagesDir === undefined) {
            excludedPageFiles.push('*.*');
        }
        if (ssgMatchResult?.publishDir) {
            excludedPageFiles.push(ssgMatchResult.publishDir);
        }
        if (ssgMatchResult?.staticDir) {
            excludedPageFiles.push(ssgMatchResult.staticDir);
        }
    }
    return excludedPageFiles;
}

function getExcludedDataFiles(rootDataDir: string, ssgMatchResult: SSGMatchResult | null): string[] {
    const excludedDataFiles = [...EXCLUDED_COMMON_FILES, ...EXCLUDED_DATA_FILES];
    if (rootDataDir === '') {
        excludedDataFiles.push('config.*', '_config.*');
        // if dataDir wasn't specifically set to empty string, ignore content files in the root folder
        if (ssgMatchResult?.dataDir === undefined) {
            excludedDataFiles.push('*.*');
        }
        if (ssgMatchResult?.publishDir) {
            excludedDataFiles.push(ssgMatchResult.publishDir);
        }
        if (ssgMatchResult?.staticDir) {
            excludedDataFiles.push(ssgMatchResult.staticDir);
        }
    }
    return excludedDataFiles;
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

interface GeneratePageModelsOptions {
    filePaths: string[];
    dirPath: string;
    fileBrowser: FileBrowser;
    pageTypeKey?: string;
    objectModels: PartialObjectModel[];
}
async function generatePageModelsForFiles({
    filePaths,
    dirPath,
    fileBrowser,
    pageTypeKey,
    objectModels
}: GeneratePageModelsOptions): Promise<{ pageModels: PartialPageModelWithFilePaths[]; objectModels: PartialObjectModel[] }> {
    let pageModels: PartialPageModel[] = [];
    let modelNameCounter = 1;

    for (const filePath of filePaths) {
        const rootFilePath = path.join(dirPath, filePath);
        const rootFilePathObject = path.parse(rootFilePath)
        let data = await fileBrowser.getFileData(rootFilePath);
        const extension = rootFilePathObject.ext.substring(1);
        // don't load plain files from root dir, even though we ignore files such as README.md when reading files,
        // there still might be plain markdown files we don't want to include
        if (rootFilePathObject.dir === '' && MARKDOWN_FILE_EXTENSIONS.includes(extension) && _.get(data, 'frontmatter') === null) {
            continue;
        }
        if (_.has(data, 'frontmatter') && _.has(data, 'markdown')) {
            data = _.assign(data.frontmatter, { markdown_content: data.markdown });
        }
        if (_.isPlainObject(data)) {
            const modelName = `page_${modelNameCounter++}`;
            const result = generateObjectFields(data, [modelName], objectModels);
            if (result) {
                const pageLayout: string | undefined = pageTypeKey && typeof data[pageTypeKey] === 'string' ? data[pageTypeKey] : undefined;
                objectModels = result.objectModels;
                pageModels.push({
                    type: 'page',
                    name: modelName,
                    ...(pageLayout && { layout: pageLayout }),
                    fields: result.fields,
                    filePaths: [filePath]
                });
            }
        }
    }

    if (pageModels.length === 0) {
        return {
            pageModels: [],
            objectModels
        };
    }

    // group models by folders, models from LCA folder put in a separate array and handle later with merged folder
    const lcaFolder = findLowestCommonAncestorFolder(_.flatten(_.map(pageModels, 'filePaths')));
    const lcaFolderModels: PartialPageModel[] = [];
    const modelsByFolder: Record<string, PartialPageModel[]> = {};
    for (let pageModel of pageModels) {
        const filePath = pageModel.filePaths[0]!;
        const dir = path.parse(filePath).dir;
        if (dir === lcaFolder) {
            lcaFolderModels.push(pageModel);
        } else {
            append(modelsByFolder, dir, pageModel);
        }
    }

    let mergedPageModels: PartialPageModel[] = [];

    // merge page models from same sub-folders (excluding LCA folder) with lowest similarity coefficient
    for (let folderPath in modelsByFolder) {
        const pageModelsInFolder = modelsByFolder[folderPath]!;
        const mergeResult = mergeSimilarPageModels(pageModelsInFolder, objectModels, SAME_FOLDER_PAGE_DSC_COEFFICIENT);
        mergedPageModels = mergedPageModels.concat(mergeResult.pageModels);
        objectModels = mergeResult.objectModels;
    }

    // merge page models from LCA folder with medium similarity coefficient
    const lcaFolderMergeResult = mergeSimilarPageModels(lcaFolderModels, objectModels, ROOT_FOLDER_PAGE_DSC_COEFFICIENT);
    mergedPageModels = mergedPageModels.concat(lcaFolderMergeResult.pageModels);
    objectModels = lcaFolderMergeResult.objectModels;

    // merge all page models from all folders with high similarity coefficient
    const mergeResult = mergeSimilarPageModels(mergedPageModels, objectModels, DIFF_FOLDER_PAGE_DSC_COEFFICIENT);

    // remove 'unknown' field type
    let pageModelsWithFilePaths = _.reduce(
        mergeResult.pageModels,
        (mergedPageModels: PartialPageModelWithFilePaths[], pageModel) => {
            const fields = removeUnknownTypesFromFields(pageModel.fields);
            if (_.isEmpty(fields)) {
                return mergedPageModels;
            }
            return mergedPageModels.concat(Object.assign(pageModel, { fields }));
        },
        []
    );

    return {
        pageModels: pageModelsWithFilePaths,
        objectModels: mergeResult.objectModels
    };
}

interface GenerateDataModelsOptions {
    filePaths: string[];
    dirPath: string;
    fileBrowser: FileBrowser;
    objectModels: PartialObjectModel[];
}

async function generateDataModelsForFiles({
    filePaths,
    dirPath,
    fileBrowser,
    objectModels
}: GenerateDataModelsOptions): Promise<{ dataModels: PartialDataModel[]; objectModels: PartialObjectModel[] }> {
    const dataModels: PartialDataModel[] = [];
    let modelNameCounter = 1;

    for (const filePath of filePaths) {
        let data = await fileBrowser.getFileData(path.join(dirPath, filePath));
        const modelName = `data_${modelNameCounter++}`;
        if (_.isPlainObject(data)) {
            const result = generateObjectFields(data, [modelName], objectModels);
            // generally, pages can be defined as JSON files as well.
            if (result) {
                objectModels = result.objectModels;
                const dataFieldsList = dataModels.filter((dataModel) => dataModel.fields).map((dataModel) => dataModel.fields!);
                const mergeResult = mergeSimilarFields(result.fields, dataFieldsList, [modelName], objectModels, 'dsc', DATA_MODEL_DSC_COEFFICIENT);
                objectModels = mergeResult.objectModels;
                const mergedDataModels = _.pullAt(dataModels, mergeResult.mergedIndexes);
                const mergedFilePaths = _.flatten(mergedDataModels.map((dataModel) => dataModel.filePaths));
                dataModels.push({
                    type: 'data',
                    name: modelName,
                    fields: mergeResult.mergedFields,
                    filePaths: [filePath].concat(mergedFilePaths)
                });
            }
        } else if (_.isArray(data)) {
            const result = generateListField(data, [modelName], objectModels);
            if (result) {
                objectModels = result.objectModels;
                dataModels.push({
                    type: 'data',
                    name: modelName,
                    isList: true,
                    items: result.field.items!,
                    filePaths: [filePath]
                });
            }
        }
    }

    return {
        dataModels,
        objectModels
    };
}

function generateObjectFields(
    value: any,
    fieldPath: FieldPath,
    objectModels: PartialObjectModel[]
): { fields: FieldWithUnknown[]; objectModels: PartialObjectModel[] } | null {
    if (_.isEmpty(value)) {
        return null;
    }
    const result = _.reduce(
        value,
        (accum: { fields: FieldWithUnknown[]; objectModels: PartialObjectModel[] }, fieldValue: any, fieldName: string) => {
            const result = generateField(fieldValue, fieldName, fieldPath.concat(fieldName), accum.objectModels);
            return {
                fields: result.field ? accum.fields.concat(result.field) : accum.fields,
                objectModels: result.objectModels
            };
        },
        { fields: [], objectModels: objectModels }
    );
    if (_.isEmpty(result.fields)) {
        return null;
    }
    return result;
}

function generateField(
    fieldValue: any,
    fieldName: string,
    fieldPath: FieldPath,
    objectModels: PartialObjectModel[]
): { field: FieldWithUnknown | null; objectModels: PartialObjectModel[] } {
    let field: FieldWithUnknown | null = null;
    if (fieldName === 'markdown_content') {
        field = {
            type: 'markdown',
            name: fieldName,
            label: 'Content'
        };
    } else if (fieldValue === null) {
        // we don't know what is the type of the field
        field = {
            type: 'unknown',
            name: fieldName,
            label: _.startCase(fieldName)
        };
    } else if (_.isString(fieldValue)) {
        field = {
            ...fieldFromStringValue(fieldValue),
            name: fieldName,
            label: _.startCase(fieldName)
        };
    } else if (_.isDate(fieldValue)) {
        // @iarna/toml returns date objects
        field = {
            type: 'datetime',
            name: fieldName,
            label: _.startCase(fieldName)
        };
    } else if (_.isNumber(fieldValue)) {
        field = {
            type: 'number',
            name: fieldName,
            label: _.startCase(fieldName),
            subtype: _.isInteger(fieldValue) ? 'int' : 'float'
        };
    } else if (_.isBoolean(fieldValue)) {
        field = {
            type: 'boolean',
            name: fieldName,
            label: _.startCase(fieldName)
        };
    } else if (_.isPlainObject(fieldValue)) {
        const result = generateObjectFields(fieldValue, fieldPath, objectModels);
        if (result) {
            objectModels = result.objectModels;
            field = {
                type: 'object',
                name: fieldName,
                label: _.startCase(fieldName),
                fields: result.fields
            };
            // const modelName = generateRandomModelName();
            // field = {
            //     type: 'model',
            //     name: fieldName,
            //     models: [modelName]
            // };
            // objectModels = result.objectModels.concat({
            //     type: 'object',
            //     name: modelName,
            //     fields: result.fields
            // });
        }
    } else if (_.isArray(fieldValue)) {
        const result = generateListField(fieldValue, fieldPath, objectModels);
        if (result) {
            objectModels = result.objectModels;
            field = {
                type: result.field.type,
                name: fieldName,
                label: _.startCase(fieldName),
                items: result.field.items
            };
        }
    }
    return {
        field,
        objectModels
    };
}

function generateListField(
    value: any[],
    fieldPath: FieldPath,
    objectModels: PartialObjectModel[]
): { field: FieldListPropsWithUnknown; objectModels: PartialObjectModel[] } | null {
    if (_.isEmpty(value)) {
        // the array is empty, so we don't know what is the type of its items, but we know there is an array.
        // This fact will help us when we will try to consolidate this array with another array
        return {
            field: listFieldWithUnknownItems(),
            objectModels: objectModels
        };
    }
    const listItemsArr: FieldListItemsWithUnknown[] = [];
    let updatedObjectModels = objectModels;
    for (let index = 0; index < value.length; index++) {
        const listItem = value[index];
        if (_.isArray(listItem)) {
            // array of arrays are not supported
            return null;
        }
        const result = generateFieldListItems(listItem, fieldPath, updatedObjectModels);
        if (result === null) {
            continue;
        }
        updatedObjectModels = result.objectModels;
        listItemsArr.push(result.items);
    }
    if (listItemsArr.length === 0) {
        // the array is empty, so we don't know what is the type of its items, but we know there is an array.
        // This fact will help us when we will try to consolidate this array with another array
        return {
            field: listFieldWithUnknownItems(),
            objectModels: objectModels
        };
    }
    const result = consolidateListItems(listItemsArr, fieldPath, updatedObjectModels);
    if (result === null) {
        return null;
    }
    return {
        field: {
            type: 'list',
            items: result.items
        },
        objectModels: result.objectModels
    };
}

function listFieldWithUnknownItems(): FieldListPropsWithUnknown {
    return {
        type: 'list',
        items: { type: 'unknown' }
    };
}

function generateFieldListItems(
    value: any,
    fieldPath: FieldPath,
    objectModels: PartialObjectModel[]
): { items: FieldListItemsWithUnknown; objectModels: PartialObjectModel[] } | null {
    let items: FieldListItemsWithUnknown | null = null;
    if (value === null) {
        // type-less value, return null to ignore. If array doesn't have any other items with types then items of that
        // array will be marked as 'unknown'
        return null;
    } else if (_.isString(value)) {
        items = fieldFromStringValue(value);
    } else if (_.isDate(value)) {
        // @iarna/toml returns date objects
        items = {
            type: 'datetime'
        };
    } else if (_.isNumber(value)) {
        items = {
            type: 'number',
            subtype: _.isInteger(value) ? 'int' : 'float'
        };
    } else if (_.isBoolean(value)) {
        items = {
            type: 'boolean'
        };
    } else if (_.isPlainObject(value)) {
        const result = generateObjectFields(value, fieldPath, objectModels);
        if (!result) {
            return null;
        }
        objectModels = result.objectModels;
        items = {
            type: 'object',
            fields: result.fields
        };
        // const modelName = generateRandomModelName();
        // items = {
        //     type: 'model',
        //     models: [modelName]
        // };
        // model = {
        //     type: 'object',
        //     name: modelName,
        //     fields: result.fields
        // };
    } else if (_.isArray(value)) {
        // we don't support array of arrays
        throw new Error('nested arrays are not supported');
    } else {
        return null;
    }
    return { items, objectModels };
}

const COLOR_PATTERN = /^#(?:[A-Fa-f0-9]{3){1,2}$/;
const HTML_PATTERN = /<[a-zA-Z]+\s*\/>|<\/?[a-zA-Z]+>/g;
const MARKDOWN_PATTERN = /^#+\s|^>\s|^-\s|^\*\s|^\+\s|\*\*[\s\S]+\*\*|__[\s\S]+__|```/m;
const DATE_PATTERN = /^([12]\d{3}-(0?[1-9]|1[0-2])-(0?[1-9]|[12]\d|3[01]))/;
const STRING_TYPES = ['string', 'text', 'markdown', 'image', 'color', 'date', 'datetime'];

function fieldFromStringValue(value: string): { type: StringFieldTypes } {
    let fieldType: StringFieldTypes = 'string';
    const fieldProps = {};

    if (value.match(COLOR_PATTERN)) {
        fieldType = 'color';
    } else if (HTML_PATTERN.test(value) || MARKDOWN_PATTERN.test(value)) {
        // TODO separate between `markdown` and `html` fields
        fieldType = 'markdown';
    } else if (value.trim().includes('\n')) {
        fieldType = 'text';
    } else if (/\.(?:svg|png|jpg|jpeg)$/.test(value)) {
        fieldType = 'image';
        // TODO: handle asset referenceTypes
        // if (value.startsWith('./') || value.startsWith('../')) {
        //     fieldProps.referenceType = 'relative';
        // }
    } else if (moment(value, moment.ISO_8601).isValid() || value.match(DATE_PATTERN)) {
        moment.suppressDeprecationWarnings = true;
        fieldType = _.endsWith(moment.utc(value).toISOString(), '00:00:00.000Z') ? 'date' : 'datetime';
    }
    return {
        type: fieldType,
        ...fieldProps
    };
}

function consolidateListItems(
    listItemModels: FieldListItemsWithUnknown[],
    fieldPath: FieldPath,
    objectModels: PartialObjectModel[]
): { items: FieldListItemsWithUnknown; objectModels: PartialObjectModel[] } | null {
    let itemTypes = _.uniq(_.map(listItemModels, 'type'));
    // if list items have multiple types and one of them 'unknown', then we assume that 'unknown' item type is actually
    // one of the other item types. So we remove it in favor of other types.
    if (itemTypes.length > 1 && itemTypes.includes('unknown')) {
        itemTypes = _.without(itemTypes, 'unknown');
    }
    if (itemTypes.length === 1) {
        const type = itemTypes[0]!;
        // handle fields with extra properties
        switch (type) {
            case 'unknown':
                return {
                    items: { type: 'unknown' },
                    objectModels
                };
            case 'number':
                const subtypes = _.compact(_.uniq(_.map(listItemModels, 'subtype')));
                const subtype = subtypes.length === 1 ? subtypes[0] : 'float';
                return {
                    items: {
                        type: 'number',
                        ...(subtype && { subtype })
                    },
                    objectModels
                };
            case 'object':
                const fieldsList = _.map(listItemModels, (itemModels) => itemModels.fields!);
                const result = consolidateObjectFieldsListWithOverlap(fieldsList, fieldPath, LIST_OBJECT_DSC_COEFFICIENT, objectModels);
                if (result.fieldsList.length === 1) {
                    return {
                        items: {
                            type: 'object',
                            fields: result.fieldsList[0]!
                        },
                        objectModels: result.objectModels
                    };
                } else {
                    const models = result.fieldsList.map(
                        (fields): PartialObjectModel => {
                            const modelName = generateRandomModelName();
                            return {
                                type: 'object',
                                name: modelName,
                                fields: fields
                                // refFields: [items],
                                // refFieldPaths: [fieldPath]
                            };
                        }
                    );
                    const items: FieldModelProps = {
                        type: 'model',
                        models: _.map(models, 'name')
                    };
                    return {
                        items: items,
                        objectModels: result.objectModels.concat(models)
                    };
                }
            case 'model':
                const modelNames = _.compact(_.uniq(_.flatten(_.map(listItemModels, 'models'))));
                return {
                    items: {
                        type: 'model',
                        models: modelNames
                    },
                    objectModels
                };
            case 'enum':
            case 'reference':
                // these cases cannot happen because we don't generate these fields,
                return null;
            default:
                return {
                    items: { type },
                    objectModels
                };
        }
    }
    if (_.every(itemTypes, (itemsType) => ['object', 'model'].includes(itemsType))) {
        const modelListItems = _.filter(listItemModels, { type: 'model' });
        const modelNames = _.compact(_.uniq(_.flatten(_.map(modelListItems, 'models'))));
        const objectListItems = _.filter(listItemModels, { type: 'object' });
        const fieldsList = _.map(objectListItems, (listItems) => listItems.fields!);
        const result = consolidateObjectFieldsListWithOverlap(fieldsList, fieldPath, LIST_OBJECT_DSC_COEFFICIENT, objectModels);
        const models = result.fieldsList.map(
            (fields): PartialObjectModel => {
                const modelName = generateRandomModelName();
                return {
                    type: 'object',
                    name: modelName,
                    fields: fields
                    // refFields: [items],
                    // refFieldPaths: [fieldPath]
                };
            }
        );
        const items: FieldListItemsWithUnknown = {
            type: 'model',
            models: modelNames.concat(_.map(models, 'name'))
        };
        return {
            items: items,
            objectModels: result.objectModels.concat(models)
        };
    }
    const fieldType = coerceSimpleFieldTypes(itemTypes);
    return fieldType
        ? {
              items: { type: fieldType },
              objectModels: objectModels
          }
        : null;
}

function consolidateObjectFieldsListWithOverlap(
    fieldsList: FieldWithUnknown[][],
    fieldPath: FieldPath,
    minCoefficient: number,
    objectModels: PartialObjectModel[]
): { fieldsList: FieldWithUnknown[][]; objectModels: PartialObjectModel[] } {
    // to reduce fragmentation sort fields arrays by length to merge the larger objects with smaller objects first
    let unmergedFieldsList = _.orderBy(fieldsList.slice(), ['length'], ['desc']);
    let idx = 0;
    const mergedFieldsList = [];

    while (unmergedFieldsList.length > 0) {
        const fields = unmergedFieldsList.shift()!;
        const result = mergeSimilarFields(fields, unmergedFieldsList, fieldPath, objectModels, 'overlap', minCoefficient);
        unmergedFieldsList = result.unmergedFieldsList;
        mergedFieldsList.push(result.mergedFields);
        objectModels = result.objectModels;
        idx++;
    }

    return {
        fieldsList: mergedFieldsList,
        objectModels: objectModels
    };
}

type SimilarityType = 'dsc' | 'overlap';

function mergeSimilarFields(
    fields: FieldWithUnknown[],
    fieldsList: FieldWithUnknown[][],
    fieldPath: FieldPath,
    objectModels: PartialObjectModel[],
    type: SimilarityType,
    minCoefficient: number
) {
    const unmergedFieldsList: FieldWithUnknown[][] = [];
    const mergedIndexes: number[] = [];
    const unmergedIndexes: number[] = [];
    const similarityFunction = type === 'dsc' ? computeDSC : computeOverlap;
    let mergedFields = fields;
    for (let i = 0; i < fieldsList.length; i++) {
        const otherFields = fieldsList[i]!;
        const dscCoefficient = similarityFunction(mergedFields, otherFields);
        // TODO: check if intersected fields have same types, otherwise don't try to merge
        if (dscCoefficient >= minCoefficient) {
            const result = mergeObjectFieldsList([mergedFields, otherFields], fieldPath, objectModels);
            if (result) {
                mergedIndexes.push(i);
                mergedFields = result.fields;
                objectModels = result.objectModels;
            } else {
                unmergedIndexes.push(i);
                unmergedFieldsList.push(otherFields);
            }
        } else {
            unmergedIndexes.push(i);
            unmergedFieldsList.push(otherFields);
        }
    }
    return { mergedFields, unmergedFieldsList, mergedIndexes, unmergedIndexes, objectModels };
}

/**
 * https://en.wikipedia.org/wiki/S%C3%B8rensen%E2%80%93Dice_coefficient
 *
 * The Sørensen–Dice coefficient gives better values than Jaccard index when
 * more elements in the two sets match in relation to sets sizes
 *
 * @param fieldsA
 * @param fieldsB
 */
function computeDSC(fieldsA: FieldWithUnknown[], fieldsB: FieldWithUnknown[]) {
    const setA = getFieldsSet(fieldsA);
    const setB = getFieldsSet(fieldsB);
    return (2 * _.intersection(setA, setB).length) / (setA.length + setB.length);
}

/**
 * https://en.wikipedia.org/wiki/Overlap_coefficient
 *
 * The Overlap coefficient gives higher values than the Sørensen–Dice coefficient
 * if one set is a subset of another
 *
 * @param fieldsA
 * @param fieldsB
 */
function computeOverlap(fieldsA: FieldWithUnknown[], fieldsB: FieldWithUnknown[]) {
    const setA = getFieldsSet(fieldsA);
    const setB = getFieldsSet(fieldsB);
    return _.intersection(setA, setB).length / Math.min(setA.length, setB.length);
}

function getFieldsSet(fields: FieldWithUnknown[]): string[] {
    // TODO: 'unknown' field type can be anything
    // TODO: do we even need to include type when computing similarity?
    return _.map(fields, (field) => {
        // const type = STRING_TYPES.includes(field.type) ? 'string' : field.type;
        // return `${field.name}:${type}`;
        return field.name;
    });
}

function mergeObjectFieldsList(
    fieldsList: FieldWithUnknown[][],
    fieldPath: FieldPath,
    objectModels: PartialObjectModel[]
): { fields: FieldWithUnknown[]; objectModels: PartialObjectModel[] } | null {
    const fieldsByName: Record<string, FieldWithUnknown[]> = _.groupBy(_.flatten(fieldsList), 'name');
    const fieldNames = Object.keys(fieldsByName);
    const consolidatedFields: FieldWithUnknown[] = [];
    for (const fieldName of fieldNames) {
        const fields = fieldsByName[fieldName]!;
        const result = consolidateFields(fields, fieldPath.concat(fieldName), objectModels);
        // if one of the fields cannot be consolidated, then the object cannot be consolidated as well
        if (!result) {
            return null;
        }
        objectModels = result.objectModels;
        consolidatedFields.push(
            _.defaults(
                {
                    type: result.field.type,
                    name: fieldName,
                    label: _.startCase(fieldName)
                },
                result.field
            )
        );
    }
    return {
        fields: consolidatedFields,
        objectModels: objectModels
    };
}

function consolidateFields(
    fields: FieldWithUnknown[],
    fieldPath: FieldPath,
    objectModels: PartialObjectModel[]
): { field: FieldPartialPropsWithUnknown; objectModels: PartialObjectModel[] } | null {
    if (fields.length === 1) {
        const field = fields[0]!;
        return {
            field: field,
            objectModels
        };
    }
    let fieldTypes = _.uniq(_.map(fields, 'type'));
    // if field types have multiple types and one of them 'unknown', then we assume that 'unknown' type is actually
    // one of the other field types. So we remove it in favor of other types.
    if (fieldTypes.length > 1 && fieldTypes.includes('unknown')) {
        fieldTypes = _.without(fieldTypes, 'unknown');
    }
    if (fieldTypes.length === 1) {
        const type = fieldTypes[0]!;
        // handle fields with extra properties
        switch (type) {
            case 'unknown':
                return {
                    field: { type: 'unknown' },
                    objectModels
                };
            case 'number':
                const subtypes = _.compact(_.uniq(_.map(fields, 'subtype')));
                const subtype = subtypes.length === 1 ? subtypes[0] : 'float';
                return {
                    field: {
                        type: 'number',
                        ...(subtype && { subtype })
                    },
                    objectModels
                };
            case 'object':
                const fieldsList = _.map(fields, (field) => field.fields!);
                const mergeResult = mergeObjectFieldsList(fieldsList, fieldPath, objectModels);
                if (!mergeResult) {
                    return null;
                }
                return {
                    field: {
                        type: 'object',
                        fields: mergeResult.fields
                    },
                    objectModels: mergeResult.objectModels
                };
            case 'list':
                const listItemsArr = _.map(fields, (field) => field.items!);
                const itemsResult = consolidateListItems(listItemsArr, fieldPath, objectModels);
                if (!itemsResult) {
                    return null;
                }
                return {
                    field: {
                        type: 'list',
                        items: itemsResult.items
                    },
                    objectModels: itemsResult.objectModels
                };
            case 'enum':
            case 'model':
            // we don't produce 'model' fields as direct child of 'object' fields, only as list items
            case 'reference':
                // these cases cannot happen because we don't generate these fields,
                return null;
            default:
                return {
                    field: { type },
                    objectModels
                };
        }
    }
    const fieldType = coerceSimpleFieldTypes(fieldTypes);
    return fieldType
        ? {
              field: { type: fieldType },
              objectModels
          }
        : null;
}

function coerceSimpleFieldTypes(fieldTypes: FieldTypeWithUnknown[]): 'string' | 'text' | 'markdown' | 'datetime' | null {
    if (_.isEmpty(_.difference(fieldTypes, ['date', 'datetime']))) {
        return 'datetime';
    }

    // use markdown as the most specific type
    if (fieldTypes.includes('markdown') && _.isEmpty(_.difference(fieldTypes, ['string', 'text', 'markdown', 'unknown']))) {
        return 'markdown';
    }

    // use text as the most specific type
    if (fieldTypes.includes('text') && _.isEmpty(_.difference(fieldTypes, ['string', 'text', 'unknown']))) {
        return 'text';
    }

    // use string if all other types can be derived from it
    if (_.every(fieldTypes, (fieldType) => STRING_TYPES.concat('unknown').includes(fieldType))) {
        return 'string';
    }

    return null;
}

function generateRandomModelName(length = 10) {
    const result = [];
    const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result.push(characters.charAt(Math.floor(Math.random() * charactersLength)));
    }
    return 'object_' + result.join('');
}

function mergeSimilarPageModels(pageModels: PartialPageModel[], objectModels: PartialObjectModel[], similarityCoefficient: number) {
    let unmergedPageModels = pageModels.slice();
    let mergedPageModels: PartialPageModel[] = [];
    while (unmergedPageModels.length > 0) {
        let pageModel = unmergedPageModels.shift()!;

        // merge with merged models
        let mergeResult = mergePageModelWithSimilarPageModels(pageModel, mergedPageModels, objectModels, similarityCoefficient);
        // unmerged models of mergedModels need to go back mergedModels, otherwise we will get infinite recursion
        mergedPageModels = mergeResult.unmergedPageModels;
        pageModel = mergeResult.pageModel;
        objectModels = mergeResult.objectModels;

        // merge with unmerged models
        mergeResult = mergePageModelWithSimilarPageModels(pageModel, unmergedPageModels, objectModels, similarityCoefficient);
        unmergedPageModels = mergeResult.unmergedPageModels;
        mergedPageModels.push(mergeResult.pageModel);
        objectModels = mergeResult.objectModels;
    }
    return {
        pageModels: mergedPageModels,
        objectModels
    };
}

function mergePageModelWithSimilarPageModels(
    pageModel: PartialPageModel,
    pageModels: PartialPageModel[],
    objectModels: PartialObjectModel[],
    similarityCoefficient: number
) {
    return pageModels.reduce(
        (accum: { pageModel: PartialPageModel; unmergedPageModels: PartialPageModel[]; objectModels: PartialObjectModel[] }, rightPageModel) => {
            const leftPageModel = accum.pageModel;
            if (leftPageModel.layout && rightPageModel.layout) {
                if (leftPageModel.layout !== rightPageModel.layout) {
                    // do not merge page models with different layouts
                    accum.unmergedPageModels.push(rightPageModel);
                    return accum;
                } else {
                    const mergeResult = mergeObjectFieldsList([leftPageModel.fields, rightPageModel.fields], [leftPageModel.name], accum.objectModels);
                    if (mergeResult) {
                        accum.objectModels = mergeResult.objectModels;
                        accum.pageModel.fields = mergeResult.fields;
                        accum.pageModel.filePaths = accum.pageModel.filePaths.concat(rightPageModel.filePaths);
                        return accum;
                    } else {
                        accum.unmergedPageModels.push(rightPageModel);
                        return accum;
                    }
                }
            } else {
                const dscCoefficient = computeDSC(leftPageModel.fields, rightPageModel.fields);
                if (dscCoefficient >= similarityCoefficient) {
                    const mergeResult = mergeObjectFieldsList([leftPageModel.fields, rightPageModel.fields], [leftPageModel.name], accum.objectModels);
                    if (mergeResult) {
                        accum.objectModels = mergeResult.objectModels;
                        accum.pageModel.fields = mergeResult.fields;
                        accum.pageModel.filePaths = accum.pageModel.filePaths.concat(rightPageModel.filePaths);
                        if (rightPageModel.layout) {
                            accum.pageModel.layout = rightPageModel.layout;
                        }
                        return accum;
                    }
                }
                accum.unmergedPageModels.push(rightPageModel);
                return accum;
            }
        },
        {
            pageModel,
            objectModels,
            unmergedPageModels: []
        }
    );
}

function analyzePageFileMatchingProperties(partialPageModels: PartialPageModelWithFilePaths[]) {
    let pageCount = 1;
    partialPageModels = _.map(
        partialPageModels,
        (partialPageModel: PartialPageModelWithFilePaths): PartialPageModelWithFilePaths => {
            const folder = findLowestCommonAncestorFolder(partialPageModel.filePaths);
            const sameFolder = allFilePathInSameFolder(partialPageModel.filePaths);
            let modelName;
            if (folder !== '') {
                modelName = getModelNameFromFilePath(folder);
            } else {
                modelName = `page_${pageCount++}`;
            }
            return {
                type: 'page',
                name: modelName,
                folder: folder,
                match: sameFolder ? '*' : '**/*',
                fields: partialPageModel.fields,
                filePaths: partialPageModel.filePaths
            };
        }
    );
    const pageModels: PageModel[] = [];
    for (let index = 0; index < partialPageModels.length; index++) {
        const model = partialPageModels[index]!;
        const otherModels = partialPageModels.slice();
        otherModels.splice(index, 1);
        const glob = (model.folder ? model.folder + '/' : '') + model.match;
        const otherFiles = _.flatten(_.map(otherModels, 'filePaths'));
        const otherNames = _.map(pageModels, 'name');
        const modelName = getUniqueName(model.name, otherNames);
        const otherModelMatchedFiles = micromatch.match(otherFiles, glob);
        let match = model.match;
        let exclude: string[] = [];
        if (otherModelMatchedFiles.length > 1) {
            match = _.map(model.filePaths, (filePath) => path.relative(model.folder || '', filePath));
        } else if (otherModelMatchedFiles.length === 1) {
            exclude = _.map(otherModelMatchedFiles, (filePath) => path.relative(model.folder || '', filePath));
        }
        pageModels.push({
            type: 'page',
            name: modelName,
            label: _.startCase(modelName),
            ...(model.folder && { folder: model.folder }),
            match: match,
            ...(!_.isEmpty(exclude) && { exclude }),
            fields: model.fields
        });
    }
    return pageModels;
}

function analyzeDataFileMatchingProperties(partialDataModels: PartialDataModel[]) {
    const dataModels: DataModel[] = [];
    let dataCount = 1;
    for (let index = 0; index < partialDataModels.length; index++) {
        const dataModelWithFilePaths = partialDataModels[index]!;
        const otherModels = partialDataModels.slice();
        otherModels.splice(index, 1);
        if (dataModelWithFilePaths.filePaths.length === 1) {
            const pathObject = path.parse(dataModelWithFilePaths.filePaths[0]!);
            const otherNames = _.map(dataModels, 'name');
            const modelName = getUniqueName(_.snakeCase(pathObject.name), otherNames);
            const modelLabel = _.startCase(modelName);
            let items: undefined | null | FieldListItems;
            let fields: undefined | Field[];
            if (dataModelWithFilePaths.isList && dataModelWithFilePaths.items) {
                items = removeUnknownTypesFromListItem(dataModelWithFilePaths.items);
                if (!items) {
                    continue;
                }
            } else {
                fields = removeUnknownTypesFromFields(dataModelWithFilePaths.fields!);
                if (_.isEmpty(fields)) {
                    continue;
                }
            }
            dataModels.push({
                type: 'data',
                name: modelName,
                label: modelLabel,
                file: dataModelWithFilePaths.filePaths[0]!,
                ...(items ? { isList: true, items } : { fields })
            });
        } else {
            const folder = findLowestCommonAncestorFolder(dataModelWithFilePaths.filePaths);
            let modelName;
            if (folder !== '') {
                modelName = getModelNameFromFilePath(folder);
            } else {
                modelName = `data_${dataCount++}`;
            }
            const otherNames = _.map(dataModels, 'name');
            modelName = getUniqueName(modelName, otherNames);
            const modelLabel = _.startCase(modelName);
            let items: undefined | null | FieldListItems;
            let fields: undefined | Field[];
            if (dataModelWithFilePaths.isList && dataModelWithFilePaths.items) {
                items = removeUnknownTypesFromListItem(dataModelWithFilePaths.items);
                if (!items) {
                    continue;
                }
            } else {
                fields = removeUnknownTypesFromFields(dataModelWithFilePaths.fields!);
                if (_.isEmpty(fields)) {
                    continue;
                }
            }
            dataModels.push({
                type: 'data',
                name: modelName,
                label: modelLabel,
                folder: folder,
                ...(items ? { isList: true, items } : { fields })
            });
        }
    }
    return dataModels;
}

function removeUnknownTypesFromFields(fields: FieldWithUnknown[]): Field[] {
    return _.reduce(
        fields,
        (accum: Field[], field: FieldWithUnknown) => {
            switch (field.type) {
                case 'unknown':
                    return accum;
                case 'object':
                    const fields = removeUnknownTypesFromFields(field.fields!);
                    if (_.isEmpty(fields)) {
                        return accum;
                    }
                    return accum.concat(Object.assign(field, { fields }));
                case 'list':
                    const items = removeUnknownTypesFromListItem(field.items!);
                    if (!items) {
                        return accum;
                    }
                    return accum.concat(Object.assign(field, { items }));
                default:
                    return accum.concat(field);
            }
        },
        []
    );
}

function removeUnknownTypesFromListItem(items: FieldListItemsWithUnknown): FieldListItems | null {
    if (items.type === 'unknown') {
        return null;
    } else if (items.type === 'object') {
        const fields = removeUnknownTypesFromFields(items.fields);
        if (_.isEmpty(fields)) {
            return null;
        }
        return Object.assign(items, { fields });
    }
    return items;
}

function extractLowestCommonAncestorFolderFromModels<T extends PageModel | DataModel>(models: T[]) {
    let commonDir: null | string[] = null;
    for (let model of models) {
        let dir;
        if (model.file) {
            dir = path.parse(model.file).dir;
        } else if (model.folder) {
            dir = model.folder;
        } else {
            dir = '';
        }
        dir = dir.split(path.sep);
        if (commonDir === null) {
            commonDir = dir;
        } else {
            let common: string[] = [];
            let j = 0;
            while (j < commonDir.length && j < dir.length && commonDir[j] === dir[j]) {
                common.push(commonDir[j]!);
                j++;
            }
            commonDir = common;
        }
        if (commonDir.length === 1 && commonDir[0] === '') {
            break;
        }
    }
    const commonDirString = commonDir === null ? '' : commonDir.join(path.sep);
    if (commonDirString === '') {
        return {
            models,
            commonDir: ''
        };
    }
    const adjustedModels = _.map(
        models,
        (model): T => {
            if (model.file) {
                return Object.assign(model, {
                    file: path.relative(commonDirString, model.file)
                });
            } else {
                const folder = path.relative(commonDirString, model.folder!);
                if (folder) {
                    return Object.assign(model, {
                        folder: folder
                    });
                } else {
                    return _.omit(model, 'folder') as T;
                }
            }
        }
    );
    return {
        models: adjustedModels,
        commonDir: commonDirString
    };
}

function findLowestCommonAncestorFolder(filePaths: string[]): string {
    if (filePaths.length === 0) {
        throw new Error('findLowestCommonAncestorFolder can not be called with empty array');
    }
    let commonDir = path.parse(filePaths[0]!).dir;
    if (commonDir === '') {
        return '';
    }
    filePaths = filePaths.slice(1);
    for (let i = 0; i < filePaths.length; i++) {
        const dir = path.parse(filePaths[i]!).dir;
        if (dir === '') {
            return '';
        }
        const commonDirParts = _.split(commonDir, path.sep);
        const dirParts = _.split(dir, path.sep);
        let common = [];
        let j = 0;
        while (j < commonDirParts.length && j < dirParts.length && commonDirParts[j] === dirParts[j]) {
            common.push(commonDirParts[j]);
            j++;
        }
        commonDir = common.join(path.sep);
        if (commonDir === '') {
            return commonDir;
        }
    }
    return commonDir;
}

function allFilePathInSameFolder(filePaths: string[]): boolean {
    const folder = path.parse(filePaths[0]!).dir;
    filePaths = filePaths.slice(1);
    return _.every(filePaths, (filePath) => path.parse(filePath).dir === folder);
}

function getUniqueName(name: string, otherNames: string[]): string {
    if (!otherNames.includes(name)) {
        return name;
    }
    let idx = 1;
    let altName = `${name}_${idx}`;
    while (otherNames.includes(altName)) {
        idx += 1;
        altName = `${name}_${idx}`;
    }
    return altName;
}

function getModelNameFromFilePath(filePath: string) {
    const lastPathPart = _.last(filePath.split(path.sep))!;
    let modelName;
    if (_.endsWith(lastPathPart, 's')) {
        modelName = lastPathPart.substring(0, lastPathPart.length - 1);
    } else {
        modelName = lastPathPart;
    }
    return _.snakeCase(modelName);
}
