import path from 'path';
import _ from 'lodash';
import micromatch from 'micromatch';
import moment from 'moment';

import { FileBrowser, FileResult, getFileBrowserFromOptions, GetFileBrowserOptions } from './file-browser';
import { SSGMatchResult } from './ssg-matcher';
import { DATA_FILE_EXTENSIONS, EXCLUDED_DATA_FILES, EXCLUDED_MARKDOWN_FILES, GLOBAL_EXCLUDES, MARKDOWN_FILE_EXTENSIONS } from '../consts';
import { DataModel, Model, ObjectModel, PageModel } from '../config/config-loader';
import { Field, FieldType, FieldListItems, FieldListProps, FieldPartialProps, FieldModelProps } from '../config/config-schema';

type FieldPath = (string | number)[];
type StringFieldTypes = Exclude<FieldType, 'number' | 'boolean' | 'enum' | 'object' | 'model' | 'reference' | 'list'>;
type PartialObjectModel = Omit<ObjectModel, 'label'> & { refFieldPaths?: FieldPath[]; refFields?: FieldModelProps[] };
type PartialPageModel = Omit<PageModel, 'label' | 'fields'> & { fields: Field[], filePaths: string[] };
type PartialDataModel = Omit<DataModel, 'label'> & { filePaths: string[] };
type PartialModel = PartialPageModel | PartialDataModel;

const SAME_FOLDER_PAGE_DSC_COEFFICIENT = 0.7;
const DIFF_FOLDER_PAGE_DSC_COEFFICIENT = 0.8;
const DATA_DSC_COEFFICIENT = 0.8;
const LIST_OBJECT_DSC_COEFFICIENT = 0.8;

export type SchemaGeneratorOptions = {
    ssgMatchResult: SSGMatchResult;
} & GetFileBrowserOptions;

export interface SchemaGeneratorResult {
    models: Model[];
    pagesDir?: string | null;
    dataDir?: string | null;
}

export async function generateSchema({ ssgMatchResult, ...fileBrowserOptions }: SchemaGeneratorOptions): Promise<SchemaGeneratorResult | null> {
    const fileBrowser = getFileBrowserFromOptions(fileBrowserOptions);
    await fileBrowser.listFiles();

    const ssgDir = ssgMatchResult.ssgDir ?? '';
    const rootPagesDir = getDir(ssgDir, ssgMatchResult.pagesDir ?? '');
    const rootDataDir = getDir(ssgDir, ssgMatchResult.dataDir ?? '');

    const excludedPageFiles = getExcludedPageFiles(ssgMatchResult, rootPagesDir);
    const excludedDataFiles = getExcludedDataFiles(ssgMatchResult, rootDataDir);

    // TODO: in some projects, pages can be defined as JSON files as well
    const pageFiles = await readDirRecursivelyWithFilter(fileBrowser, rootPagesDir, excludedPageFiles, MARKDOWN_FILE_EXTENSIONS);
    const dataFiles = await readDirRecursivelyWithFilter(fileBrowser, rootDataDir, excludedDataFiles, DATA_FILE_EXTENSIONS);

    const pageModelsResults = await generatePageModelsForFiles({
        filePaths: pageFiles,
        dirPath: rootPagesDir,
        fileBrowser: fileBrowser,
        pageTypeKey: ssgMatchResult.pageTypeKey,
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

    let pagesDir = ssgMatchResult.pagesDir;
    if (pagesDir === undefined && pageModels.length > 0) {
        const result = extractLowestCommonAncestorFolderFromModels(pageModels);
        pagesDir = getDir(ssgDir, result.commonDir);
        pageModels = result.models;
    }
    let dataDir = ssgMatchResult.dataDir;
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
                fields: objectModel.fields
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

function getExcludedPageFiles(ssgMatchResult: SSGMatchResult, rootPagesDir: string): string[] {
    const excludedPageFiles = [...GLOBAL_EXCLUDES, ...EXCLUDED_MARKDOWN_FILES];
    if (rootPagesDir === '') {
        // if pagesDir wasn't specifically set to empty string, ignore content files in the root folder
        if (ssgMatchResult.pagesDir === undefined) {
            excludedPageFiles.push('*.*');
        }
        if (ssgMatchResult.publishDir) {
            excludedPageFiles.push(ssgMatchResult.publishDir);
        }
        if (ssgMatchResult.staticDir) {
            excludedPageFiles.push(ssgMatchResult.staticDir);
        }
    }
    return excludedPageFiles;
}

function getExcludedDataFiles(ssgMatchResult: SSGMatchResult, rootDataDir: string): string[] {
    const excludedDataFiles = [...GLOBAL_EXCLUDES, ...EXCLUDED_DATA_FILES];
    if (rootDataDir === '') {
        excludedDataFiles.push('config.*', '_config.*');
        // if dataDir wasn't specifically set to empty string, ignore content files in the root folder
        if (ssgMatchResult.dataDir === undefined) {
            excludedDataFiles.push('*.*');
        }
        if (ssgMatchResult.publishDir) {
            excludedDataFiles.push(ssgMatchResult.publishDir);
        }
        if (ssgMatchResult.staticDir) {
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
}: GeneratePageModelsOptions): Promise<{ pageModels: PartialPageModel[]; objectModels: PartialObjectModel[] }> {
    let pageModels: PartialPageModel[] = [];
    let modelNameCounter = 1;
    for (const filePath of filePaths) {
        let data = await fileBrowser.getFileData(path.join(dirPath, filePath));
        const extension = path.extname(filePath).substring(1);
        if (MARKDOWN_FILE_EXTENSIONS.includes(extension) && _.get(data, 'frontmatter') === null) {
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
                const mergeResult = mergeFieldsWithSimilarPageModels({
                    pageLayout,
                    fields: result.fields,
                    filePath,
                    modelName,
                    pageModels,
                    objectModels: result.objectModels
                });
                pageModels = mergeResult.pageModels;
                objectModels = mergeResult.objectModels;
            }
        }
    }

    return {
        pageModels,
        objectModels
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
    for (const filePath of filePaths) {
        let data = await fileBrowser.getFileData(path.join(dirPath, filePath));
        const pathObject = path.parse(filePath);
        const modelName = _.snakeCase(pathObject.name);
        if (_.isPlainObject(data)) {
            const result = generateObjectFields(data, [modelName], objectModels);
            // generally, pages can be defined as JSON files as well.
            if (result) {
                objectModels = result.objectModels;
                const dataFieldsList = dataModels.filter((dataModel) => dataModel.fields).map((dataModel) => dataModel.fields!);
                const mergeResult = mergeSimilarFields(result.fields, dataFieldsList, [modelName], DATA_DSC_COEFFICIENT, objectModels);
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
): { fields: Field[]; objectModels: PartialObjectModel[] } | null {
    if (_.isEmpty(value)) {
        return null;
    }
    const result = _.reduce(
        value,
        (accum: { fields: Field[]; objectModels: PartialObjectModel[] }, fieldValue: any, fieldName: string) => {
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
): { field: Field | null; objectModels: PartialObjectModel[] } {
    let field: Field | null = null;
    if (fieldValue === null) {
        // TODO: return 'unknown' field type and coerce it to string, or consolidate with anything else
        // we don't know what is the type of the field
        field = null;
    }
    if (fieldName === 'markdown_content') {
        field = {
            type: 'markdown',
            name: fieldName,
            label: 'Content'
        };
    } else if (_.isString(fieldValue)) {
        field = {
            ...fieldFromStringValue(fieldValue),
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
): { field: FieldListProps; objectModels: PartialObjectModel[] } | null {
    if (_.isEmpty(value)) {
        // we don't know what is the type of array items
        return null;
    }
    const listItemsArr: FieldListItems[] = [];
    for (let index = 0; index < value.length; index++) {
        const listItem = value[index];
        if (_.isArray(listItem)) {
            // array of arrays are not supported
            return null;
        }
        const result = generateFieldListItems(listItem, fieldPath, objectModels);
        if (result === null) {
            continue;
        }
        objectModels = result.objectModels;
        listItemsArr.push(result.items);
    }
    if (listItemsArr.length === 0) {
        return null;
    }
    const result = consolidateListItems(listItemsArr, fieldPath, objectModels);
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

function generateFieldListItems(
    value: any,
    fieldPath: FieldPath,
    objectModels: PartialObjectModel[]
): { items: FieldListItems; objectModels: PartialObjectModel[] } | null {
    let items: FieldListItems | null = null;
    if (value === null) {
        // type-less value
        return null;
    } else if (_.isString(value)) {
        items = fieldFromStringValue(value);
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
    listItemModels: FieldListItems[],
    fieldPath: FieldPath,
    objectModels: PartialObjectModel[]
): { items: FieldListItems; objectModels: PartialObjectModel[] } | null {
    const itemTypes = _.uniq(_.map(listItemModels, 'type'));
    if (itemTypes.length === 1) {
        const type = itemTypes[0]!;
        // handle fields with extra properties
        switch (type) {
            case 'number':
                const subtypes = _.compact(_.uniq(_.map(listItemModels, 'subtype')));
                const subtype = subtypes.length === 1 ? subtypes[0] : 'float';
                return {
                    items: {
                        type: 'number',
                        // name: fieldName,
                        ...(subtype && { subtype })
                    },
                    objectModels
                };
            case 'object':
                const fieldsList = _.map(listItemModels, 'fields') as Field[][];
                const result = consolidateObjectFieldsListWithDSC(fieldsList, fieldPath, LIST_OBJECT_DSC_COEFFICIENT, objectModels);
                if (!result) {
                    return null;
                }
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
                    const items: FieldListItems = {
                        type: 'model',
                        models: _.map(models, 'name')
                    };
                    return {
                        items: items,
                        objectModels: result.objectModels.concat(models)
                    };
                }
            case 'model':
                const models = _.compact(_.uniq(_.flatten(_.map(listItemModels, 'models'))));
                return {
                    items: {
                        type: 'model',
                        models: models
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
    const fieldType = coerceSimpleFieldTypes(itemTypes);
    return fieldType
        ? {
              items: { type: fieldType },
              objectModels: objectModels
          }
        : null;
}

type FieldNameTypeMap = Record<Field['name'], FieldType>;

function consolidateObjectFieldsList(
    fieldsList: Field[][],
    fieldPath: FieldPath,
    objectModels: PartialObjectModel[]
): { fieldsList: Field[][]; objectModels: PartialObjectModel[] } | null {
    const fieldsListGroups: { fieldNameTypeMap: FieldNameTypeMap; fieldsList: Field[][] }[] = [];
    for (const fields of fieldsList) {
        const fieldNameTypeMap = fields.reduce((fieldMap: FieldNameTypeMap, field: Field) => {
            const type = STRING_TYPES.includes(field.type) ? 'string' : field.type;
            return { ...fieldMap, [field.name]: type };
        }, {});
        let group = _.find(fieldsListGroups, (group) => _.isEqual(group.fieldNameTypeMap, fieldNameTypeMap));
        if (!group) {
            group = {
                fieldNameTypeMap: fieldNameTypeMap,
                fieldsList: []
            };
            fieldsListGroups.push(group);
        }
        group.fieldsList.push(fields);
    }
    const mergedFieldsList = [];
    for (const group of fieldsListGroups) {
        const result = mergeObjectFieldsList(group.fieldsList, fieldPath, objectModels);
        if (!result) {
            return null;
        }
        mergedFieldsList.push(result.fields);
        objectModels = result.objectModels;
    }
    return {
        fieldsList: mergedFieldsList,
        objectModels: objectModels
    };
}

// https://en.wikipedia.org/wiki/S%C3%B8rensen%E2%80%93Dice_coefficient
function consolidateObjectFieldsListWithDSC(
    fieldsList: Field[][],
    fieldPath: FieldPath,
    minCoefficient: number,
    objectModels: PartialObjectModel[]
): { fieldsList: Field[][]; objectModels: PartialObjectModel[] } {
    let unmergedFieldsList = fieldsList.slice();
    let idx = 0;
    const mergedFieldsList = [];

    while (unmergedFieldsList.length > 0) {
        const fields = unmergedFieldsList.pop()!;
        const result = mergeSimilarFields(fields, unmergedFieldsList, fieldPath, minCoefficient, objectModels);
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

function mergeSimilarFields(fields: Field[], fieldsList: Field[][], fieldPath: FieldPath, minCoefficient: number, objectModels: PartialObjectModel[]) {
    const unmergedFieldsList: Field[][] = [];
    const mergedIndexes: number[] = [];
    const unmergedIndexes: number[] = [];
    let mergedFields = fields;
    for (let i = 0; i < fieldsList.length; i++) {
        const otherFields = fieldsList[i]!;
        const dscCoefficient = computeDSC(mergedFields, otherFields);
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

function computeDSC(fieldsA: Field[], fieldsB: Field[]) {
    const setA = getFieldsSet(fieldsA);
    const setB = getFieldsSet(fieldsB);
    return (2 * _.intersection(setA, setB).length) / (setA.length + setB.length);
}

function getFieldsSet(fields: Field[]): string[] {
    return _.map(fields, (field) => {
        const type = STRING_TYPES.includes(field.type) ? 'string' : field.type;
        return `${field.name}:${type}`;
    });
}

function mergeObjectFieldsList(
    fieldsList: Field[][],
    fieldPath: FieldPath,
    objectModels: PartialObjectModel[]
): { fields: Field[]; objectModels: PartialObjectModel[] } | null {
    const fieldsByName: Record<string, Field[]> = _.groupBy(_.flatten(fieldsList), 'name');
    const fieldNames = Object.keys(fieldsByName);
    const consolidatedFields: Field[] = [];
    for (const fieldName of fieldNames) {
        const fields = fieldsByName[fieldName]!;
        const result = consolidateFields(fields, fieldPath.concat(fieldName), objectModels);
        // if one of the fields cannot be consolidated, then the object cannot be consolidated as well
        if (!result) {
            return null;
        }
        objectModels = result.objectModels;
        consolidatedFields.push({
            name: fieldName,
            ...result.field
        });
    }
    return {
        fields: consolidatedFields,
        objectModels: objectModels
    };
}

function consolidateFields(
    fields: Field[],
    fieldPath: FieldPath,
    objectModels: PartialObjectModel[]
): { field: FieldPartialProps; objectModels: PartialObjectModel[] } | null {
    if (fields.length === 1) {
        return {
            field: fields[0]!,
            objectModels
        };
    }
    // TODO: merge field labels
    const fieldTypes = _.uniq(_.map(fields, 'type'));
    if (fieldTypes.length === 1) {
        const type = fieldTypes[0]!;
        // handle fields with extra properties
        switch (type) {
            case 'number':
                const subtypes = _.compact(_.uniq(_.map(fields, 'subtype')));
                const subtype = subtypes.length === 1 ? subtypes[0] : 'float';
                return {
                    field: {
                        type: 'number',
                        // name: fieldName,
                        ...(subtype && { subtype })
                    },
                    objectModels
                };
            case 'object':
                const fieldsList = _.map(fields, 'fields') as Field[][];
                const mergeResult = mergeObjectFieldsList(fieldsList, fieldPath, objectModels);
                if (!mergeResult) {
                    return null;
                }
                return {
                    field: {
                        type: 'object',
                        // name: fieldName,
                        fields: mergeResult.fields
                    },
                    objectModels: mergeResult.objectModels
                };
            case 'list':
                const listItemsArr = _.map(fields, 'items') as FieldListItems[];
                const itemsResult = consolidateListItems(listItemsArr, fieldPath, []);
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

function coerceSimpleFieldTypes(fieldTypes: FieldType[]): 'string' | 'text' | 'markdown' | null {
    // use markdown as the most specific type
    if (fieldTypes.includes('markdown') && _.isEmpty(_.difference(fieldTypes, ['string', 'text', 'markdown']))) {
        return 'markdown';
    }

    // use text as the most specific type
    if (fieldTypes.includes('text') && _.isEmpty(_.difference(fieldTypes, ['string', 'text']))) {
        return 'text';
    }

    // use string if all other types can be derived from it
    if (_.every(fieldTypes, (fieldType) => STRING_TYPES.includes(fieldType))) {
        return 'string';
    }

    return null;
}

function generateRandomModelName(length = 10) {
    const result = [];
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result.push(characters.charAt(Math.floor(Math.random() * charactersLength)));
    }
    return result.join('');
}

interface MergeSimilarPageModelsOptions {
    pageLayout: string | undefined;
    fields: Field[];
    filePath: string;
    modelName: string;
    pageModels: PartialPageModel[];
    objectModels: PartialObjectModel[];
}

interface MergeSimilarPageModelsResult {
    pageModels: PartialPageModel[];
    objectModels: PartialObjectModel[];
}

function mergeFieldsWithSimilarPageModels({ pageLayout, fields, filePath, modelName, pageModels, objectModels }: MergeSimilarPageModelsOptions): MergeSimilarPageModelsResult {
    const result = pageModels.reduce((accum, pageModel) => {
        if (accum.pageLayout && pageModel.layout) {
            if (accum.pageLayout !== pageModel.layout) {
                // do not merge page models with different layouts
                accum.pageModels.push(pageModel);
                return accum;
            } else {
                const mergeResult = mergeObjectFieldsList([accum.fields, pageModel.fields], [modelName], accum.objectModels);
                if (mergeResult) {
                    accum.fields = mergeResult.fields;
                    accum.objectModels = mergeResult.objectModels;
                    accum.filePaths = accum.filePaths.concat(pageModel.filePaths);
                    return accum;
                } else {
                    accum.pageModels.push(pageModel);
                    return accum;
                }
            }
        } else {
            const dscCoefficient = computeDSC(accum.fields, pageModel.fields);
            const sameFolder = allFilePathInSameFolder([...accum.filePaths, ...pageModel.filePaths]);
            const minCoefficient = sameFolder ? SAME_FOLDER_PAGE_DSC_COEFFICIENT : DIFF_FOLDER_PAGE_DSC_COEFFICIENT;
            if (dscCoefficient >= minCoefficient) {
                const mergeResult = mergeObjectFieldsList([accum.fields, pageModel.fields], [modelName], accum.objectModels);
                if (mergeResult) {
                    accum.fields = mergeResult.fields;
                    accum.objectModels = mergeResult.objectModels;
                    accum.filePaths = accum.filePaths.concat(pageModel.filePaths);
                    if (pageModel.layout) {
                        accum.pageLayout = pageModel.layout;
                    }
                    return accum;
                }
            }
            accum.pageModels.push(pageModel);
            return accum;
        }
    }, {
        pageLayout: pageLayout,
        fields: fields,
        filePaths: [filePath],
        pageModels: [] as PartialPageModel[],
        objectModels: objectModels
    });
    return {
        pageModels: result.pageModels.concat({
            type: 'page',
            name: modelName,
            ...(result.pageLayout && { layout: result.pageLayout }),
            fields: result.fields,
            filePaths: result.filePaths
        }),
        objectModels: result.objectModels
    }
}

function analyzePageFileMatchingProperties(pageModelsWithFilePaths: PartialPageModel[]) {
    let pageCount = 1;
    pageModelsWithFilePaths = _.map(
        pageModelsWithFilePaths,
        (pageModel: PartialPageModel): PartialPageModel => {
            const folder = findCommonAncestorFolder(pageModel.filePaths);
            const lastPart = _.last(folder.split(path.sep));
            const sameFolder = allFilePathInSameFolder(pageModel.filePaths);
            let modelName;
            if (lastPart) {
                if (_.endsWith(lastPart, 's')) {
                    modelName = lastPart.substring(0, lastPart.length - 1);
                } else {
                    modelName = lastPart;
                }
                modelName = _.snakeCase(modelName);
            } else {
                modelName = `page_${pageCount++}`;
            }
            return {
                type: 'page',
                name: modelName,
                folder: folder,
                match: sameFolder ? '*' : '**/*',
                fields: pageModel.fields,
                filePaths: pageModel.filePaths
            };
        }
    );
    const pageModels: PageModel[] = [];
    for (let index = 0; index < pageModelsWithFilePaths.length; index++) {
        const model = pageModelsWithFilePaths[index]!;
        const otherModels = pageModelsWithFilePaths.slice();
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

function analyzeDataFileMatchingProperties(dataModelsWithFilePaths: PartialDataModel[]) {
    const dataModels: DataModel[] = [];
    const modelNames: string[] = [];
    for (let index = 0; index < dataModelsWithFilePaths.length; index++) {
        const dataModelWithFilePaths = dataModelsWithFilePaths[index]!;
        const otherModels = dataModelsWithFilePaths.slice();
        otherModels.splice(index, 1);
        const modelName = getUniqueName(dataModelWithFilePaths.name, modelNames);
        const modelLabel = _.startCase(modelName);
        modelNames.push(modelName);
        if (dataModelWithFilePaths.filePaths.length === 1) {
            dataModels.push({
                type: 'data',
                name: modelName,
                label: modelLabel,
                file: dataModelWithFilePaths.filePaths[0]!,
                ...(dataModelWithFilePaths.isList && dataModelWithFilePaths.items
                    ? { isList: true, items: dataModelWithFilePaths.items }
                    : { fields: dataModelWithFilePaths.fields })
            });
        } else {
            const folder = findCommonAncestorFolder(dataModelWithFilePaths.filePaths);
            dataModels.push({
                type: 'data',
                name: modelName,
                label: modelLabel,
                folder: folder,
                ...(dataModelWithFilePaths.isList && dataModelWithFilePaths.items
                    ? { isList: true, items: dataModelWithFilePaths.items }
                    : { fields: dataModelWithFilePaths.fields })
            });
        }
    }
    return dataModels;
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

function findCommonAncestorFolder(filePaths: string[]): string {
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

function getUniqueName(name: string, otherNames: string[], idx = 1): string {
    if (!otherNames.includes(name)) {
        return name;
    }
    const altName = `${name}_${idx}`;
    if (!otherNames.includes(altName)) {
        return altName;
    }
    return getUniqueName(name, otherNames, idx + 1);
}
