import { StricterUnion } from '../utils';
import { CMS_NAMES, FIELD_TYPES, SSG_NAMES } from './config-consts';

export interface Config extends BaseConfig {
    models: Model[];
}

export interface YamlConfig extends BaseConfig {
    models?: ModelMap;
}

interface BaseConfig {
    stackbitVersion: string;
    ssgName?: typeof SSG_NAMES[number];
    ssgVersion?: string;
    nodeVersion?: string;
    devCommand?: string;
    cmsName?: typeof CMS_NAMES[number];
    import?: Import;
    buildCommand?: string;
    publishDir?: string;
    staticDir?: string;
    uploadDir?: string;
    assets?: Assets;
    pagesDir?: string | null;
    dataDir?: string | null;
    pageLayoutKey?: string | null;
    objectTypeKey?: string;
    excludePages?: string | string[];
    logicFields?: LogicField[];
    modelsSource?: ModelsSource;
}

export type Import = ContentfulImport | SanityImport;

export interface ContentfulImport {
    type: 'contentful';
    contentFile: string;
    uploadAssets?: boolean;
    assetsDirectory?: string;
    spaceIdEnvVar?: string;
    accessTokenEnvVar?: string;
}

export interface SanityImport {
    type: 'sanity';
    contentFile: string;
    sanityStudioPath: string;
    deployStudio?: boolean;
    deployGraphql?: boolean;
    projectIdEnvVar?: string;
    datasetEnvVar?: string;
    tokenEnvVar?: string;
}

export type Assets = StricterUnion<StaticAssets | RelativeAssets>;

export interface StaticAssets {
    referenceType: 'static';
    assetsDir?: string;
    staticDir: string;
    publicPath: string;
    uploadDir?: string;
}

export interface RelativeAssets {
    referenceType: 'relative';
    assetsDir: string;
    staticDir?: string;
    publicPath?: string;
    uploadDir?: string;
}

export type LogicField = string;

export interface ModelsSource {
    type: 'files';
    modelDirs: string[];
}

/*******************
 *** Model Types ***
 *******************/

export type Model = StricterUnion<ObjectModel | DataModel | PageModel | ConfigModel>;

export type ObjectModel = YamlObjectModel & BaseModel;
export type DataModel = YamlDataModel & BaseModel;
export type PageModel = YamlPageModel & BaseModel;
export type ConfigModel = YamlConfigModel & BaseModel;

export type BaseModel = {
    name: string;
};

export type ModelMap = Record<string, YamlModel>;

export type YamlModel = StricterUnion<YamlObjectModel | YamlDataModel | YamlPageModel | YamlConfigModel>;

export interface YamlBaseModel {
    type: 'object' | 'data' | 'page' | 'config';
    __metadata?: {
        filePath?: string;
        invalid?: boolean;
    };
    label: string;
    description?: string;
    thumbnail?: string;
    extends?: string | string[];
    labelField?: string;
    variantField?: string;
    categories?: string[];
    fieldGroups?: FieldGroupItem[];
    fields?: Field[];
}

export interface YamlObjectModel extends YamlBaseModel {
    type: 'object';
}

export interface BaseDataModel extends YamlBaseModel {
    type: 'data';
}

export interface BasePageModel extends YamlBaseModel {
    type: 'page';
    layout?: string;
    urlPath?: string;
    filePath?: string;
    hideContent?: boolean;
}

export interface YamlConfigModel extends YamlBaseModel {
    type: 'config';
    file?: string;
}

interface BaseMatch {
    folder?: string;
    match?: string | string[];
    exclude?: string | string[];
}

export type YamlDataModel = StricterUnion<BaseDataModelFileSingle | BaseDataModelFileList | BaseDataModelMatchSingle | BaseDataModelMatchList>;

export interface BaseDataModelFileSingle extends BaseDataModel {
    file: string;
    isList?: false;
}

export interface BaseDataModelFileList extends Omit<BaseDataModel, 'fields'> {
    file: string;
    isList: true;
    items: FieldListItems;
}

export interface BaseDataModelMatchSingle extends BaseDataModel, BaseMatch {
    isList?: false;
}

export interface BaseDataModelMatchList extends Omit<BaseDataModel, 'fields'>, BaseMatch {
    isList: true;
    items: FieldListItems;
}

export type YamlPageModel = StricterUnion<PageModelSingle | PageModelMatch>;

export interface PageModelSingle extends BasePageModel {
    singleInstance: true;
    file: string;
}

export interface PageModelMatch extends BasePageModel, BaseMatch {
    singleInstance?: false;
}

export interface FieldGroupItem {
    name: string;
    label: string;
}

/*******************
 *** Field Types ***
 *******************/

export type Field = FieldSimple | FieldEnum | FieldNumber | FieldObject | FieldModel | FieldReference | FieldList;

export type FieldSimple = FieldCommonProps & FieldSimpleProps;
export type FieldEnum = FieldCommonProps & FieldEnumProps;
export type FieldNumber = FieldCommonProps & FieldNumberProps;
export type FieldObject = FieldCommonProps & FieldObjectProps;
export type FieldModel = FieldCommonProps & FieldModelProps;
export type FieldReference = FieldCommonProps & FieldReferenceProps;
export type FieldList = FieldCommonProps & FieldListProps;

export type FieldListObject = FieldList & { items?: FieldObjectProps };
export type FieldListModel = FieldList & { items?: FieldModelProps };
export type FieldListReference = FieldList & { items?: FieldReferenceProps };

export interface FieldCommonProps {
    type: FieldType;
    name: string;
    label?: string;
    description?: string;
    required?: boolean;
    default?: unknown;
    group?: string;
    const?: unknown;
    hidden?: boolean;
    readOnly?: boolean;
}

export type FieldType = typeof FIELD_TYPES[number];

export interface FieldSimpleProps {
    type: 'string' | 'url' | 'slug' | 'text' | 'markdown' | 'html' | 'boolean' | 'date' | 'datetime' | 'color' | 'image' | 'file';
}

export type FieldEnumProps = FieldEnumDropdownProps | FieldEnumThumbnailsProps | FieldEnumPaletteProps;

export interface FieldEnumDropdownProps {
    type: 'enum';
    controlType?: 'dropdown' | 'button-group';
    options: FieldEnumOptionValue[] | FieldEnumOptionObject[];
}

export interface FieldEnumThumbnailsProps {
    type: 'enum';
    controlType: 'thumbnails';
    options: FieldEnumOptionThumbnails[];
}

export interface FieldEnumPaletteProps {
    type: 'enum';
    controlType: 'palette';
    options: FieldEnumOptionPalette[];
}

export type FieldEnumOptionValue = string | number;

export interface FieldEnumOptionObject {
    label: string;
    value: FieldEnumOptionValue;
}

export interface FieldEnumOptionThumbnails extends FieldEnumOptionObject {
    thumbnail?: string;
}

export interface FieldEnumOptionPalette extends FieldEnumOptionObject {
    textColor?: string;
    backgroundColor?: string;
    borderColor?: string;
}

export interface FieldNumberProps {
    type: 'number';
    subtype?: 'int' | 'float';
    min?: number;
    max?: number;
    step?: number;
}

export interface FieldObjectProps {
    type: 'object';
    labelField?: string;
    thumbnail?: string;
    variantField?: string;
    fieldGroups?: string;
    fields: Field[];
}

export interface FieldModelProps {
    type: 'model';
    models: string[];
    categories?: string[];
}

export interface FieldReferenceProps {
    type: 'reference';
    models: string[];
    categories?: string[];
}

export interface FieldListProps {
    type: 'list';
    items?: FieldListItems;
}

export type FieldListItems = FieldSimpleProps | FieldEnumProps | FieldNumberProps | FieldObjectProps | FieldModelProps | FieldReferenceProps;
