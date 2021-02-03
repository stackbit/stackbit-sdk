declare module '@stackbit/schema' {
    export function iterateModelFieldsRecursively(model: any, iterator: (field: any, fieldPath: string[]) => void): string;
}
