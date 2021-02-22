type FieldPath = (string | number)[];

export class CustomError extends Error {
    constructor(message: string) {
        super(message);
        Error.captureStackTrace(this, CustomError);
    }
}

export class FileNotMatchedModel extends Error {
    filePath: string;
    constructor({ filePath }: { filePath: string }) {
        super(`file '${filePath}' does not match any model`);
        this.filePath = filePath;
    }
}

export class FileMatchedMultipleModels extends Error {
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

export class FileForModelNotFound extends Error {
    modelName: string;
    constructor({ modelName }: { modelName: string }) {
        super(`file for model '${modelName}' not found`);
        this.modelName = modelName;
    }
}

export class ModelNotFound extends Error {
    modelName: string;
    fieldPath: FieldPath;
    constructor({ modelName, fieldPath }: { modelName: string; fieldPath: FieldPath }) {
        super(`model '${modelName}' referenced in '${fieldPath.join('.')}' not found`);
        this.modelName = modelName;
        this.fieldPath = fieldPath;
    }
}

export class IllegalModelField extends Error {
    modelName: string;
    modelType: string;
    fieldPath: FieldPath;
    constructor({ modelName, modelType, fieldPath }: { modelName: string; modelType: string; fieldPath: FieldPath }) {
        super(
            `field of type 'model' can not reference model of type other than 'object', field '${fieldPath.join(
                '.'
            )}' referenced model '${modelName}' of type '${modelType}'`
        );
        this.modelName = modelName;
        this.modelType = modelType;
        this.fieldPath = fieldPath;
    }
}

export class ContentValidationError extends Error {
    filePath: string;
    value: any;
    fieldPath: FieldPath;
    constructor({ message, filePath, value, fieldPath }: { message: string; filePath: string; value: any; fieldPath: FieldPath }) {
        super(message);
        this.filePath = filePath;
        this.fieldPath = fieldPath;
        this.value = value;
    }
}
