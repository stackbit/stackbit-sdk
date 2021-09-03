export class ConfigLoadError extends Error {
    name: 'ConfigLoadError';
    originalError?: Error;
    constructor(message: string, { originalError }: { originalError?: Error } = {}) {
        super(message);
        this.name = 'ConfigLoadError';
        this.originalError = originalError;
    }
}
