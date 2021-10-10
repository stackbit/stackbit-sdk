type FieldPath = (string | number)[];

export class CustomError extends Error {
    constructor(message: string) {
        super(message);
        Error.captureStackTrace(this, CustomError);
    }
}

export class FileNotMatchedModelError extends Error {
    filePath: string;
    constructor({ filePath }: { filePath: string }) {
        super(`file '${filePath}' does not match any model`);
        this.filePath = filePath;
    }
}

export class FileMatchedMultipleModelsError extends Error {
    filePath: string;
    modelNames: string[];
    constructor({ filePath, modelNames }: { filePath: string; modelNames: string[] }) {
        super(`file '${filePath}' matches several models '${modelNames.join(', ')}'`);
        this.filePath = filePath;
        this.modelNames = modelNames;
    }
}

export class FileReadError extends Error {
    filePath: string;
    error: Error;
    constructor({ filePath, error }: { filePath: string; error: Error }) {
        super(`file '${filePath}' could not be loaded:  ${error.message}`);
        this.filePath = filePath;
        this.error = error;
    }
}

export class FolderReadError extends Error {
    folderPath: string;
    error: Error;
    constructor({ folderPath, error }: { folderPath: string; error: Error }) {
        super(`folder '${folderPath}' could not be loaded: ${error.message}`);
        this.folderPath = folderPath;
        this.error = error;
    }
}

export class FileForModelNotFoundError extends Error {
    modelName: string;
    constructor({ modelName }: { modelName: string }) {
        super(`file for model '${modelName}' not found`);
        this.modelName = modelName;
    }
}

export class ModelNotFoundError extends Error {
    modelName: string;
    fieldPath: FieldPath;
    constructor({ modelName, fieldPath }: { modelName: string; fieldPath: FieldPath }) {
        super(`model '${modelName}' referenced in '${fieldPath.join('.')}' not found`);
        this.modelName = modelName;
        this.fieldPath = fieldPath;
    }
}

export class IllegalModelFieldError extends Error {
    modelName: string;
    modelType: string;
    fieldPath: FieldPath;
    constructor({ modelName, modelType, fieldPath }: { modelName: string; modelType: string; fieldPath: FieldPath }) {
        super(
            `field of type 'model' cannot reference model of type other than 'object', field '${fieldPath.join(
                '.'
            )}' referenced model '${modelName}' of type '${modelType}'`
        );
        this.modelName = modelName;
        this.modelType = modelType;
        this.fieldPath = fieldPath;
    }
}

export class ContentValidationError extends Error {
    name: 'ContentValidationError';
    type: string;
    modelName: string;
    filePath: string;
    value: any;
    fieldPath: FieldPath;
    constructor({
        type,
        message,
        modelName,
        filePath,
        value,
        fieldPath
    }: {
        type: string;
        message: string;
        modelName: string;
        filePath: string;
        value: any;
        fieldPath: FieldPath;
    }) {
        super(message);
        this.name = 'ContentValidationError';
        this.type = type;
        this.modelName = modelName;
        this.filePath = filePath;
        this.fieldPath = fieldPath;
        this.value = value;
        // redefine "message" as enumerable, this helps seeing the provided and the expected message in failed Jest's toMatchObject calls
        Object.defineProperty(this, 'message', { value: message, writable: true, enumerable: true, configurable: true });
    }
}
