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
type PartialObjectModel = Omit<ObjectModel, 'name' | 'label'> & { refFieldPaths?: FieldPath[]; refFields?: FieldModelProps[] };
type StringFieldTypes = Exclude<FieldType, 'number' | 'boolean' | 'enum' | 'object' | 'model' | 'reference' | 'list'>;

export interface FieldModelRefProps {
    type: 'modelRef';
    models: PartialObjectModel[];
}

type FieldListItemsWithModelRef = FieldListItems | FieldModelRefProps;

export type SchemaGeneratorOptions = {
    ssgMatchResult: SSGMatchResult;
} & GetFileBrowserOptions;

export interface SchemaGeneratorResult {
    models: Model[];
}

export async function generateSchema({ ssgMatchResult, ...fileBrowserOptions }: SchemaGeneratorOptions): Promise<SchemaGeneratorResult | null> {
    const fileBrowser = getFileBrowserFromOptions(fileBrowserOptions);
    await fileBrowser.listFiles();

    const ssgDir = ssgMatchResult.ssgDir ?? '';
    const pagesDir = ssgMatchResult.pagesDir ?? '';
    const dataDir = ssgMatchResult.dataDir ?? '';
    const fullPagesDir = path.join(ssgDir, pagesDir);
    const fullDataDir = path.join(ssgDir, dataDir);

    const excludedPageFiles = [...GLOBAL_EXCLUDES, ...EXCLUDED_MARKDOWN_FILES];
    const excludedDataFiles = ['config.*', '_config.*', ...GLOBAL_EXCLUDES, ...EXCLUDED_DATA_FILES];
    if (ssgMatchResult.publishDir) {
        excludedPageFiles.push(ssgMatchResult.publishDir);
        excludedDataFiles.push(ssgMatchResult.publishDir);
    }

    const pageFiles = await readDirRecursivelyWithFilter(fileBrowser, fullPagesDir, excludedPageFiles, MARKDOWN_FILE_EXTENSIONS);
    const dataFiles = await readDirRecursivelyWithFilter(fileBrowser, fullDataDir, excludedDataFiles, DATA_FILE_EXTENSIONS);

    const pageModels = await generateModelsForFiles(pageFiles, fileBrowser);
    const dataModels = await generateModelsForFiles(dataFiles, fileBrowser);
    const models = _.concat(pageModels, dataModels);

    return {
        models: models
    };
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

async function generateModelsForFiles(pageFilePaths: string[], fileBrowser: FileBrowser): Promise<Model[]> {
    const pageModels: PageModel[] = [];
    const dataModels: DataModel[] = [];
    const partialObjectModels: PartialObjectModel[] = [];
    for (const pageFilePath of pageFilePaths) {
        let data = await fileBrowser.getFileData(pageFilePath);
        const pathObject = path.parse(pageFilePath);
        const extension = pathObject.ext.substring(1);
        const isMarkdownFile = MARKDOWN_FILE_EXTENSIONS.includes(extension);
        if (isMarkdownFile && _.has(data, 'frontmatter') && _.has(data, 'markdown')) {
            data = _.assign(data.frontmatter, { markdown_content: data.markdown });
        }
        if (_.isPlainObject(data)) {
            const result = generateObjectFields(data, [pageFilePath]);
            // generally, pages can be defined as JSON files as well.
            if (result) {
                if (isMarkdownFile) {
                    const modelName = `page_${pageModels.length + 1}`;
                    pageModels.push({
                        type: 'page',
                        name: modelName,
                        label: _.startCase(modelName),
                        fields: result.fields
                    });
                } else {
                    const modelName = _.snakeCase(pathObject.name);
                    dataModels.push({
                        type: 'data',
                        name: modelName,
                        label: _.startCase(modelName),
                        fields: result.fields
                    });
                }
                if (!_.isEmpty(result.objectModels)) {
                    partialObjectModels.push(...result.objectModels);
                }
            }
        } else if (_.isArray(data)) {
            const result = generateListField(data, [pageFilePath]);
            const modelName = _.snakeCase(pathObject.name);
            if (result) {
                dataModels.push({
                    type: 'data',
                    name: modelName,
                    label: _.startCase(modelName),
                    isList: true,
                    items: result.field.items!
                });
                if (!_.isEmpty(result.objectModels)) {
                    partialObjectModels.push(...result.objectModels);
                }
            }
        }
    }
    const pageFieldsList = _.map(pageModels, (pageModel) => pageModel.fields!);
    const mergedPageFieldsList = consolidateObjectFieldsListWithDSC(pageFieldsList, ['page'], 0.75);
    partialObjectModels.push(...mergedPageFieldsList.objectModels);
    const mergedPageModels = _.map(
        mergedPageFieldsList.fieldsList,
        (fields, index): PageModel => {
            const modelName = `page_${index + 1}`;
            return {
                type: 'page',
                name: modelName,
                label: _.startCase(modelName),
                fields: fields
            };
        }
    );
    const objectModels = _.map(partialObjectModels, (partialObjectModel, index): ObjectModel => {
        const modelName = `object_${index + 1}`;
        return {
            type: 'object',
            name: modelName,
            label: _.startCase(modelName),
            fields: partialObjectModel.fields
        }
    });
    return [...mergedPageModels, ...dataModels, ...objectModels];
}

function generateObjectFields(value: any, fieldPath: FieldPath): { fields: Field[]; objectModels: PartialObjectModel[] } | null {
    if (_.isEmpty(value)) {
        return null;
    }
    const result = _.reduce(
        value,
        (accum: { fields: Field[]; objectModels: PartialObjectModel[] }, value: any, key: string) => {
            const { field, objectModels } = generateField(value, key, fieldPath.concat(key));
            return {
                fields: field ? accum.fields.concat(field) : accum.fields,
                objectModels: accum.objectModels.concat(objectModels)
            };
        },
        { fields: [], objectModels: [] }
    );
    if (_.isEmpty(result.fields)) {
        return null;
    }
    return result;
}

function generateField(value: any, key: string, fieldPath: FieldPath): { field: Field | null; objectModels: PartialObjectModel[] } {
    let field: Field | null = null;
    let objectModels: PartialObjectModel[] = [];
    if (value === null) {
        // we don't know what is the type of the field
        field = null;
    }
    if (key === 'markdown_content') {
        field = {
            type: 'markdown',
            name: key,
            label: 'Content'
        };
    } else if (_.isString(value)) {
        field = {
            ...fieldFromStringValue(value),
            name: key
        };
    } else if (_.isNumber(value)) {
        field = {
            type: 'number',
            name: key,
            subtype: _.isInteger(value) ? 'int' : 'float'
        };
    } else if (_.isBoolean(value)) {
        field = {
            type: 'boolean',
            name: key
        };
    } else if (_.isPlainObject(value)) {
        const result = generateObjectFields(value, fieldPath);
        if (result) {
            field = {
                type: 'object',
                name: key,
                fields: result.fields
            };
            // const modelName = modelNameFromFieldPath(fieldPath);
            // field = {
            //     type: 'model',
            //     name: key,
            //     models: [modelName]
            // };
            // objectModels = result.objectModels.concat({
            //     type: 'object',
            //     name: modelName,
            //     label: 'temp',
            //     fields: result.fields
            // });
        }
    } else if (_.isArray(value)) {
        const result = generateListField(value, fieldPath);
        if (result) {
            // objectModels = result.objectModels;
            field = {
                type: result.field.type,
                name: key,
                items: result.field.items
            };
        }
    }
    if (field && field.label === undefined) {
        field.label = _.startCase(field.name);
    }
    return {
        field,
        objectModels
    };
}

function generateListField(value: any[], fieldPath: FieldPath): { field: FieldListProps; objectModels: PartialObjectModel[] } | null {
    if (_.isEmpty(value)) {
        // we don't know what is the type of array items
        return null;
    }
    const listItemsArr: FieldListItems[] = [];
    const childModels: PartialObjectModel[] = [];
    const nestedModels: PartialObjectModel[] = [];
    for (let index = 0; index < value.length; index++) {
        const listItem = value[index];
        if (_.isArray(listItem)) {
            // array of arrays are not supported
            return null;
        }
        const result = generateFieldListItems(listItem, fieldPath);
        const { items, model, objectModels } = result;
        if (items === null) {
            continue;
        }
        listItemsArr.push(items);
        if (model) {
            childModels.push(model);
        }
        if (!_.isEmpty(objectModels)) {
            nestedModels.push(...objectModels);
        }
    }
    if (listItemsArr.length === 0) {
        return null;
    }
    const result = consolidateListItems(listItemsArr, fieldPath, childModels);
    if (result === null) {
        return null;
    }
    return {
        field: {
            type: 'list',
            items: result.items
        },
        objectModels: result.objectModels ? nestedModels.concat(result.objectModels) : nestedModels
    };
}

function generateFieldListItems(
    value: any,
    fieldPath: FieldPath
): { items: FieldListItems | null; model: PartialObjectModel | null; objectModels: PartialObjectModel[] } {
    let items: FieldListItems | null = null;
    let model: PartialObjectModel | null = null;
    let objectModels: PartialObjectModel[] = [];
    if (value === null) {
        // type-less value
        items = null;
    } else if (_.isString(value)) {
        items = {
            ...fieldFromStringValue(value)
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
        const result = generateObjectFields(value, fieldPath);
        if (result) {
            objectModels = result.objectModels;
            items = {
                type: 'object',
                fields: result.fields
            };
            // const modelName = modelNameFromFieldPath(fieldPath);
            // items = {
            //     type: 'model',
            //     models: [modelName]
            // };
            // model = {
            //     type: 'object',
            //     name: modelName,
            //     label: 'temp',
            //     fields: result.fields
            // };
        }
    } else if (_.isArray(value)) {
        // we don't support array of arrays
        throw new Error('nested arrays are not supported');
    }
    return {
        items,
        model,
        objectModels
    };
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
    childModels: PartialObjectModel[]
): { items: FieldListItems; objectModels?: PartialObjectModel[] } | null {
    const itemTypes = _.uniq(_.map(listItemModels, 'type'));
    if (itemTypes.length === 1) {
        const type = itemTypes[0]!;
        // handle fields with extra properties
        switch (type) {
            case 'number':
                const subtypes = _.compact(_.uniq(_.map(listItemModels, 'subtype')));
                const subtype = subtypes.length === 1 ? subtypes[0] : null;
                return {
                    items: {
                        type: 'number',
                        // name: fieldName,
                        ...(subtype && { subtype })
                    }
                };
            case 'object':
                // TODO: lists can have variable types of object, create an algorithm
                //  that will merge similar objects into a single model and split different
                //  objects between several models
                const fieldsList = _.map(listItemModels, 'fields') as Field[][];
                const result = consolidateObjectFieldsList(fieldsList, fieldPath);
                if (!result) {
                    return null;
                }
                if (result.fieldsList.length === 1) {
                    return {
                        items: {
                            type: 'object',
                            fields: result.fieldsList[0]!
                        }
                    };
                } else {
                    const items: FieldListItems = {
                        type: 'model',
                        models: []
                    };
                    const models = result.fieldsList.map((fields, idx): PartialObjectModel => {
                        return {
                            type: 'object',
                            fields: fields,
                            // refFields: [items],
                            // refFieldPaths: [fieldPath]
                        };
                    });
                    // items.modelsReferences = models;
                    return {
                        items: items,
                        objectModels: result.objectModels.concat(models)
                    };
                }
            case 'model':
                const models = _.compact(_.uniq(_.flatten(_.map(listItemModels, 'models'))));
                const modelReferences = _.map(listItemModels, 'modelReferences');
                return {
                    items: {
                        type: 'model',
                        models: models,
                        // modelsReferences: modelReferences
                    }
                };
            case 'enum':
            case 'reference':
                // these cases cannot happen because we don't generate these fields,
                return null;
            default:
                return { items: { type } };
        }
    }
    const fieldType = coerceSimpleFieldTypes(itemTypes);
    return fieldType
        ? {
              items: { type: fieldType },
              objectModels: []
          }
        : null;
}

type FieldNameTypeMap = Record<Field['name'], FieldType>;

function consolidateObjectFieldsList(fieldsList: Field[][], fieldPath: FieldPath): { fieldsList: Field[][]; objectModels: PartialObjectModel[] } | null {
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
    const objectModels = [];
    for (const group of fieldsListGroups) {
        const result = mergeObjectFieldsList(group.fieldsList, fieldPath);
        if (!result) {
            return null;
        }
        mergedFieldsList.push(result.fields);
        objectModels.push(...result.objectModels);
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
    minCoefficient: number
): { fieldsList: Field[][]; objectModels: PartialObjectModel[] } {
    const mergeSimilarFields = function (fields: Field[], fieldsList: Field[][], fieldPath: FieldPath) {
        const objectModels = [];
        const unmergedFieldsList: Field[][] = [];
        let mergedFields = fields;
        for (let i = 0; i < fieldsList.length; i++) {
            const otherFields = fieldsList[i]!;
            const dscCoefficient = computeDSC(mergedFields, otherFields);
            if (dscCoefficient >= minCoefficient) {
                const result = mergeObjectFieldsList([mergedFields, otherFields], fieldPath.concat(i));
                if (result) {
                    mergedFields = result.fields;
                    objectModels.push(...result.objectModels);
                } else {
                    unmergedFieldsList.push(otherFields);
                }
            } else {
                unmergedFieldsList.push(otherFields);
            }
        }
        return { mergedFields, unmergedFieldsList, objectModels };
    };

    let unmergedFieldsList = fieldsList.slice();
    let idx = 0;
    const mergedFieldsList = [];
    const objectModels = [];
    while (unmergedFieldsList.length > 0) {
        const fields = unmergedFieldsList.pop()!;
        const result = mergeSimilarFields(fields, unmergedFieldsList, fieldPath.concat(idx));
        unmergedFieldsList = result.unmergedFieldsList;
        mergedFieldsList.push(result.mergedFields);
        objectModels.push(...result.objectModels);
        idx++;
    }

    return {
        fieldsList: mergedFieldsList,
        objectModels: objectModels
    };
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

function mergeObjectFieldsList(fieldsList: Field[][], fieldPath: FieldPath): { fields: Field[]; objectModels: PartialObjectModel[] } | null {
    const fieldsByName: Record<string, Field[]> = _.groupBy(_.flatten(fieldsList), 'name');
    const fieldNames = Object.keys(fieldsByName);
    const consolidatedFields: Field[] = [];
    const objectModels: PartialObjectModel[] = [];
    for (const fieldName of fieldNames) {
        const fields = fieldsByName[fieldName]!;
        const result = consolidateFields(fields, fieldPath.concat(fieldName));
        // if one of the fields cannot be consolidated, then the object cannot be consolidated as well
        if (!result) {
            return null;
        }
        consolidatedFields.push({
            name: fieldName,
            ...result.field
        });
        if (result.objectModels) {
            objectModels.push(...result.objectModels);
        }
    }
    return {
        fields: consolidatedFields,
        objectModels: objectModels
    };
}

function consolidateFields(fields: Field[], fieldPath: FieldPath): { field: FieldPartialProps; objectModels?: PartialObjectModel[] } | null {
    if (fields.length === 1) {
        return { field: fields[0]! };
    }
    const fieldTypes = _.uniq(_.map(fields, 'type'));
    if (fieldTypes.length === 1) {
        const type = fieldTypes[0]!;
        // handle fields with extra properties
        switch (type) {
            case 'number':
                const subtypes = _.compact(_.uniq(_.map(fieldTypes, 'subtype')));
                const subtype = subtypes.length === 1 ? subtypes[0] : null;
                return {
                    field: {
                        type: 'number',
                        // name: fieldName,
                        ...(subtype && { subtype })
                    }
                };
            case 'object':
                const fieldsList = _.map(fields, 'fields') as Field[][];
                const mergeResult = mergeObjectFieldsList(fieldsList, fieldPath);
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
                return { field: { type } };
        }
    }
    const fieldType = coerceSimpleFieldTypes(fieldTypes);
    return fieldType ? { field: { type: fieldType } } : null;
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

function modelNameFromFieldPath(fieldPath: FieldPath): string {
    return fieldPath.join('_');
}
