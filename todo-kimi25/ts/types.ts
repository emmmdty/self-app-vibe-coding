/**
 * 待办事项应用类型定义
 * 参考 Microsoft To Do 设计
 */

// 子任务接口
export interface SubTask {
    id: string;
    text: string;
    completed: boolean;
}

// 任务优先级
export type Priority = 'low' | 'normal' | 'high';

// 任务对象接口
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

// 任务列表接口
export interface TodoList {
    id: string;
    name: string;
    icon: string;
    isDefault?: boolean;
    isSmart?: boolean;
}

// 筛选类型
export type FilterType = 'all' | 'active' | 'completed' | 'important' | 'planned';

// 主题类型
export type Theme = 'blue' | 'green' | 'purple' | 'orange' | 'pink' | 'cyan' | 'red' | 'dark';

// 设备类型
export type DeviceType = 'desktop' | 'tablet' | 'mobile';

// 任务统计信息
export interface TodoStats {
    completed: number;
    total: number;
    important: number;
    planned: number;
}

// 存储数据接口
export interface StorageData {
    todos: Todo[];
    lists: TodoList[];
    currentListId: string;
    theme: Theme;
}

// 主题配置接口
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

// 应用配置
export interface AppConfig {
    storageKey: string;
    defaultTheme: Theme;
    maxTodoLength: number;
    defaultListId: string;
}

// 错误类型
export class TodoError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'TodoError';
    }
}

export class ValidationError extends TodoError {
    constructor(message: string) {
        super(message);
        this.name = 'ValidationError';
    }
}

export class StorageError extends TodoError {
    constructor(message: string) {
        super(message);
        this.name = 'StorageError';
    }
}
