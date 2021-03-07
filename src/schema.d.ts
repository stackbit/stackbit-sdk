declare module '@stackbit/schema' {
    import { Model } from './config/config-loader';

    interface BaseModelQuery {
        filePath: string;
    }

    interface TypedModelQuery extends BaseModelQuery {
        type: string | null;
        modelTypeKeyPath: string | string[];
    }

    type ModelQuery = BaseModelQuery | TypedModelQuery;

    export function iterateModelFieldsRecursively(model: Model, iterator: (field: Field, fieldPath: string[]) => void): void;
    export function getModelsByQuery(query: ModelQuery, models: Model[]): Model[];
    export function extendModels(models: Model[]): Model[];
    export function isListField(field: { type: string }): boolean;
}

declare module '@stackbit/utils' {
    import fs from 'fs';
    export function parseFile(filePath: string): Promise<any>;
    export function readDirRecursively(dir: string, options?: { filter: (filePath: string, stats: fs.Stats) => boolean }): Promise<string[]>;
    export function forEachPromise<T>(array: T[], callback: (value: T, index: number, array: T[]) => Promise<void>, thisArg?: any): Promise<void>;
    export function findPromise<T>(array: T[], callback: (value: T, index: number, array: T[]) => Promise<boolean>, thisArg?: any): Promise<T | undefined>;
}
