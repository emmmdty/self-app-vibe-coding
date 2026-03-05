import { StorageData, AppConfig } from './types.js';
declare const config: AppConfig;
export declare class Storage {
    private static instance;
    private storageKey;
    private constructor();
    static getInstance(): Storage;
    save(data: StorageData): void;
    load(): StorageData;
    clear(): void;
    isAvailable(): boolean;
}
export { config };
//# sourceMappingURL=storage.d.ts.map