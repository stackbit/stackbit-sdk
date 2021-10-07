export class ConfigLoadError extends Error {
    name: 'ConfigLoadError';
    originalError?: Error;
    constructor(message: string, { originalError }: { originalError?: Error } = {}) {
        super(message);
        this.name = 'ConfigLoadError';
        this.originalError = originalError;
    }
}

export class ConfigValidationError extends Error {
    name: 'ConfigValidationError';
    type: string;
    fieldPath: (string | number)[];
    normFieldPath: (string | number)[];
    value?: any;
    constructor({
        message,
        type,
        fieldPath,
        normFieldPath,
        value
    }: {
        message: string;
        type: string;
        fieldPath: (string | number)[];
        normFieldPath?: (string | number)[];
        value?: any;
    }) {
        super(message);
        this.name = 'ConfigValidationError';
        this.type = type;
        this.fieldPath = fieldPath;
        this.normFieldPath = normFieldPath || fieldPath;
        this.value = value;
    }
}

export class ConfigPresetsError extends Error {
    name: 'ConfigPresetsError';
    constructor(message: string) {
        super(message);
        this.name = 'ConfigPresetsError';
    }
}

export type ConfigError = ConfigLoadError | ConfigValidationError | ConfigPresetsError;
