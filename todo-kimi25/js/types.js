export class TodoError extends Error {
    constructor(message) {
        super(message);
        this.name = 'TodoError';
    }
}
export class ValidationError extends TodoError {
    constructor(message) {
        super(message);
        this.name = 'ValidationError';
    }
}
export class StorageError extends TodoError {
    constructor(message) {
        super(message);
        this.name = 'StorageError';
    }
}
//# sourceMappingURL=types.js.map