import { StorageData, StorageError, AppConfig } from './types.js';

const config: AppConfig = {
    storageKey: 'todo-app-data',
    defaultTheme: 'blue',
    maxTodoLength: 200,
    defaultListId: 'my-day'
};

export class Storage {
    private static instance: Storage;
    private storageKey: string;

    private constructor() {
        this.storageKey = config.storageKey;
    }

    static getInstance(): Storage {
        if (!Storage.instance) {
            Storage.instance = new Storage();
        }
        return Storage.instance;
    }

    save(data: StorageData): void {
        try {
            const jsonData = JSON.stringify(data);
            localStorage.setItem(this.storageKey, jsonData);
        } catch (error) {
            throw new StorageError('保存数据失败: ' + (error as Error).message);
        }
    }

    load(): StorageData {
        try {
            const jsonData = localStorage.getItem(this.storageKey);
            if (!jsonData) {
                return { 
                    todos: [], 
                    lists: [],
                    currentListId: config.defaultListId,
                    theme: config.defaultTheme 
                };
            }
            const data = JSON.parse(jsonData) as StorageData;
            return {
                todos: data.todos || [],
                lists: data.lists || [],
                currentListId: data.currentListId || config.defaultListId,
                theme: data.theme || config.defaultTheme
            };
        } catch (error) {
            throw new StorageError('读取数据失败: ' + (error as Error).message);
        }
    }

    clear(): void {
        try {
            localStorage.removeItem(this.storageKey);
        } catch (error) {
            throw new StorageError('清除数据失败: ' + (error as Error).message);
        }
    }

    isAvailable(): boolean {
        try {
            const test = '__storage_test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch {
            return false;
        }
    }
}

export { config };
