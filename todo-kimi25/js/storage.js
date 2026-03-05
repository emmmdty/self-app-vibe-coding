import { StorageError } from './types.js';
const config = {
    storageKey: 'todo-app-data',
    defaultTheme: 'blue',
    maxTodoLength: 200,
    defaultListId: 'my-day'
};
export class Storage {
    constructor() {
        this.storageKey = config.storageKey;
    }
    static getInstance() {
        if (!Storage.instance) {
            Storage.instance = new Storage();
        }
        return Storage.instance;
    }
    save(data) {
        try {
            const jsonData = JSON.stringify(data);
            localStorage.setItem(this.storageKey, jsonData);
        }
        catch (error) {
            throw new StorageError('保存数据失败: ' + error.message);
        }
    }
    load() {
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
            const data = JSON.parse(jsonData);
            return {
                todos: data.todos || [],
                lists: data.lists || [],
                currentListId: data.currentListId || config.defaultListId,
                theme: data.theme || config.defaultTheme
            };
        }
        catch (error) {
            throw new StorageError('读取数据失败: ' + error.message);
        }
    }
    clear() {
        try {
            localStorage.removeItem(this.storageKey);
        }
        catch (error) {
            throw new StorageError('清除数据失败: ' + error.message);
        }
    }
    isAvailable() {
        try {
            const test = '__storage_test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        }
        catch {
            return false;
        }
    }
}
export { config };
//# sourceMappingURL=storage.js.map