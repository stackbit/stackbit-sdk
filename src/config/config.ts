export interface StackbitConfig {
    stackbitVersion: string;
    ssgName: string;
    cmsName: string;
    models: Model[];
}

type Model = ObjectModel | PageModel | DataModel;

interface BaseModel {
    name: string;
    label: string;
    description: string;
    labelField: string;
    fields: Fields[];
}

export interface ObjectModel extends BaseModel {
    type: 'object';
}

export interface PageModel extends BaseModel {
    type: 'page';
    urlPath: string;
}

export interface DataModel extends BaseModel {
    type: 'data' | 'config';
}

export interface Fields {
    name: string;
    label?: string;
}
