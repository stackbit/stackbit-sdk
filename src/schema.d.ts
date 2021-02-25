declare module '@stackbit/schema' {
    import { IModel } from './config/config-loader';

    interface BaseModelQuery {
        filePath: string;
    }

    interface TypedModelQuery extends BaseModelQuery {
        type: string | null;
        modelTypeKeyPath: string | string[];
    }

    type ModelQuery = BaseModelQuery | TypedModelQuery;

    export function iterateModelFieldsRecursively(model: IModel, iterator: (field: IField, fieldPath: string[]) => void): void;
    export function getModelsByQuery(query: ModelQuery, models: IModel[]): IModel[];
    export function extendModels(models: IModel[]): IModel[];
}

declare module '@stackbit/utils' {
    import fs from 'fs';
    export function getFirstExistingFile(fileNames: string[], inputDir: string): Promise<string | undefined>;
    export function parseFile(filePath: string): Promise<any>;
    export function readDirRecursively(dir: string, options?: { filter: (filePath: string, stats: fs.Stats) => boolean }): Promise<string[]>;
    export function forEachPromise<T>(array: T[], callback: (value: T, index: number, array: T[]) => Promise<void>, thisArg?: any): Promise<void>;
}
