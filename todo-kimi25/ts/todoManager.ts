import { Todo, TodoList, TodoStats, ValidationError, Theme, FilterType, SubTask, StorageData } from './types.js';
import { Storage, config } from './storage.js';

export class TodoManager {
    private todos: Todo[];
    private lists: TodoList[];
    private storage: Storage;
    private currentTheme: Theme;
    private currentListId: string;

    constructor() {
        this.storage = Storage.getInstance();
        const data = this.storage.load();
        this.todos = data.todos || [];
        this.currentTheme = data.theme || config.defaultTheme;
        this.currentListId = data.currentListId || 'my-day';
        
        // 初始化默认列表
        this.lists = data.lists || this.getDefaultLists();
        
        // 确保有默认列表
        if (this.lists.length === 0) {
            this.lists = this.getDefaultLists();
        }
    }

    private getDefaultLists(): TodoList[] {
        return [
            { id: 'my-day', name: '我的一天', icon: 'sun', isDefault: true, isSmart: true },
            { id: 'important', name: '重要', icon: 'star', isDefault: true, isSmart: true },
            { id: 'planned', name: '计划内', icon: 'calendar', isDefault: true, isSmart: true },
            { id: 'all', name: '全部', icon: 'list', isDefault: true, isSmart: true },
            { id: 'tasks', name: '任务', icon: 'list', isDefault: true }
        ];
    }

    // 生成唯一ID
    private generateId(): string {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    // 验证任务文本
    private validateTodoText(text: string): void {
        const trimmedText = text.trim();
        
        if (!trimmedText) {
            throw new ValidationError('任务内容不能为空');
        }
        
        if (trimmedText.length > config.maxTodoLength) {
            throw new ValidationError(`任务内容不能超过 ${config.maxTodoLength} 个字符`);
        }
    }

    // 添加任务
    addTodo(text: string, listId?: string): Todo {
        this.validateTodoText(text);
        
        const targetListId = listId || this.getTargetListId();
        
        const newTodo: Todo = {
            id: this.generateId(),
            text: text.trim(),
            completed: false,
            createdAt: Date.now(),
            priority: 'normal',
            isImportant: false,
            subTasks: [],
            listId: targetListId
        };
        
        this.todos.unshift(newTodo);
        this.save();
        
        return newTodo;
    }

    // 获取目标列表ID
    private getTargetListId(): string {
        // 如果当前是智能列表，使用默认任务列表
        if (['my-day', 'important', 'planned', 'all'].includes(this.currentListId)) {
            return 'tasks';
        }
        return this.currentListId;
    }

    // 切换任务完成状态
    toggleTodo(id: string): Todo | null {
        const todo = this.todos.find(t => t.id === id);
        if (todo) {
            todo.completed = !todo.completed;
            this.save();
            return todo;
        }
        return null;
    }

    // 删除任务
    deleteTodo(id: string): boolean {
        const index = this.todos.findIndex(t => t.id === id);
        if (index !== -1) {
            this.todos.splice(index, 1);
            this.save();
            return true;
        }
        return false;
    }

    // 更新任务文本
    updateTodoText(id: string, text: string): boolean {
        const todo = this.todos.find(t => t.id === id);
        if (todo && text.trim()) {
            todo.text = text.trim();
            this.save();
            return true;
        }
        return false;
    }

    // 切换重要状态
    toggleImportant(id: string): boolean {
        const todo = this.todos.find(t => t.id === id);
        if (todo) {
            todo.isImportant = !todo.isImportant;
            this.save();
            return true;
        }
        return false;
    }

    // 更新截止日期
    updateDueDate(id: string, dueDate?: number): boolean {
        const todo = this.todos.find(t => t.id === id);
        if (todo) {
            todo.dueDate = dueDate;
            this.save();
            return true;
        }
        return false;
    }

    // 更新备注
    updateNote(id: string, note: string): boolean {
        const todo = this.todos.find(t => t.id === id);
        if (todo) {
            todo.note = note;
            this.save();
            return true;
        }
        return false;
    }

    // 添加子任务
    addSubtask(todoId: string, text: string): SubTask | null {
        const todo = this.todos.find(t => t.id === todoId);
        if (todo && text.trim()) {
            const subtask: SubTask = {
                id: this.generateId(),
                text: text.trim(),
                completed: false
            };
            todo.subTasks.push(subtask);
            this.save();
            return subtask;
        }
        return null;
    }

    // 切换子任务完成状态
    toggleSubtask(todoId: string, subtaskId: string): boolean {
        const todo = this.todos.find(t => t.id === todoId);
        if (todo) {
            const subtask = todo.subTasks.find(s => s.id === subtaskId);
            if (subtask) {
                subtask.completed = !subtask.completed;
                this.save();
                return true;
            }
        }
        return false;
    }

    // 获取任务
    getTodoById(id: string): Todo | undefined {
        return this.todos.find(t => t.id === id);
    }

    // 获取筛选后的任务
    getFilteredTodos(filter: FilterType): Todo[] {
        let filtered = this.getCurrentListTodos();
        
        switch (filter) {
            case 'active':
                return filtered.filter(t => !t.completed);
            case 'completed':
                return filtered.filter(t => t.completed);
            default:
                return filtered;
        }
    }

    // 获取当前列表的任务
    private getCurrentListTodos(): Todo[] {
        switch (this.currentListId) {
            case 'my-day':
                return this.getMyDayTodos();
            case 'important':
                return this.todos.filter(t => t.isImportant);
            case 'planned':
                return this.todos.filter(t => t.dueDate);
            case 'all':
                return [...this.todos];
            default:
                return this.todos.filter(t => t.listId === this.currentListId);
        }
    }

    // 获取"我的一天"任务
    private getMyDayTodos(): Todo[] {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        return this.todos.filter(todo => {
            // 包含今天的任务
            if (todo.dueDate) {
                const dueDate = new Date(todo.dueDate);
                dueDate.setHours(0, 0, 0, 0);
                if (dueDate.getTime() === today.getTime()) {
                    return true;
                }
            }
            // 包含标记为重要的未完成任务
            if (todo.isImportant && !todo.completed) {
                return true;
            }
            return false;
        });
    }

    // 获取统计信息
    getStats(): TodoStats {
        const completed = this.todos.filter(t => t.completed).length;
        return {
            completed,
            total: this.todos.length,
            important: this.todos.filter(t => t.isImportant).length,
            planned: this.todos.filter(t => t.dueDate).length
        };
    }

    // 获取智能列表计数
    getSmartListCounts(): { myDay: number; important: number; planned: number; all: number } {
        return {
            myDay: this.getMyDayTodos().filter(t => !t.completed).length,
            important: this.todos.filter(t => t.isImportant && !t.completed).length,
            planned: this.todos.filter(t => t.dueDate && !t.completed).length,
            all: this.todos.filter(t => !t.completed).length
        };
    }

    // 获取当前主题
    getTheme(): Theme {
        return this.currentTheme;
    }

    // 设置主题
    setTheme(theme: Theme): void {
        this.currentTheme = theme;
        this.save();
    }

    // 获取当前列表ID
    getCurrentListId(): string {
        return this.currentListId;
    }

    // 设置当前列表
    setCurrentList(listId: string): void {
        this.currentListId = listId;
        this.save();
    }

    // 获取列表
    getListById(id: string): TodoList | undefined {
        return this.lists.find(l => l.id === id);
    }

    // 获取自定义列表
    getCustomLists(): TodoList[] {
        return this.lists.filter(l => !l.isSmart);
    }

    // 添加列表
    addList(name: string): TodoList {
        const newList: TodoList = {
            id: this.generateId(),
            name: name.trim(),
            icon: 'list'
        };
        this.lists.push(newList);
        this.save();
        return newList;
    }

    // 获取列表任务数
    getListCount(listId: string): number {
        if (listId === 'all') {
            return this.todos.filter(t => !t.completed).length;
        }
        return this.todos.filter(t => t.listId === listId && !t.completed).length;
    }

    // 保存到本地存储
    private save(): void {
        const data: StorageData = {
            todos: this.todos,
            lists: this.lists,
            currentListId: this.currentListId,
            theme: this.currentTheme
        };
        this.storage.save(data);
    }

    // 清空所有任务
    clearAll(): void {
        this.todos = [];
        this.save();
    }
}
