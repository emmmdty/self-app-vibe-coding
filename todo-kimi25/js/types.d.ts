export interface SubTask {
    id: string;
    text: string;
    completed: boolean;
}
export type Priority = 'low' | 'normal' | 'high';
export interface Todo {
    id: string;
    text: string;
    completed: boolean;
    createdAt: number;
    dueDate?: number;
    reminder?: number;
    priority: Priority;
    isImportant: boolean;
    note?: string;
    subTasks: SubTask[];
    listId: string;
}
export interface TodoList {
    id: string;
    name: string;
    icon: string;
    isDefault?: boolean;
    isSmart?: boolean;
}
export type FilterType = 'all' | 'active' | 'completed' | 'important' | 'planned';
export type Theme = 'blue' | 'green' | 'purple' | 'orange' | 'pink' | 'cyan' | 'red' | 'dark';
export type DeviceType = 'desktop' | 'tablet' | 'mobile';
export interface TodoStats {
    completed: number;
    total: number;
    important: number;
    planned: number;
}
export interface StorageData {
    todos: Todo[];
    lists: TodoList[];
    currentListId: string;
    theme: Theme;
}
export interface ThemeConfig {
    name: string;
    primary: string;
    primaryLight: string;
    primaryDark: string;
    background: string;
    surface: string;
    surfaceHover: string;
    text: string;
    textSecondary: string;
    border: string;
    shadow: string;
}
export interface AppConfig {
    storageKey: string;
    defaultTheme: Theme;
    maxTodoLength: number;
    defaultListId: string;
}
export declare class TodoError extends Error {
    constructor(message: string);
}
export declare class ValidationError extends TodoError {
    constructor(message: string);
}
export declare class StorageError extends TodoError {
    constructor(message: string);
}
//# sourceMappingURL=types.d.ts.map