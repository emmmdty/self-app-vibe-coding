import { ValidationError } from './types.js';
import { Storage, config } from './storage.js';
export class TodoManager {
    constructor() {
        this.storage = Storage.getInstance();
        const data = this.storage.load();
        this.todos = data.todos || [];
        this.currentTheme = data.theme || config.defaultTheme;
        this.currentListId = data.currentListId || 'my-day';
        this.lists = data.lists || this.getDefaultLists();
        if (this.lists.length === 0) {
            this.lists = this.getDefaultLists();
        }
    }
    getDefaultLists() {
        return [
            { id: 'my-day', name: '我的一天', icon: 'sun', isDefault: true, isSmart: true },
            { id: 'important', name: '重要', icon: 'star', isDefault: true, isSmart: true },
            { id: 'planned', name: '计划内', icon: 'calendar', isDefault: true, isSmart: true },
            { id: 'all', name: '全部', icon: 'list', isDefault: true, isSmart: true },
            { id: 'tasks', name: '任务', icon: 'list', isDefault: true }
        ];
    }
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
    validateTodoText(text) {
        const trimmedText = text.trim();
        if (!trimmedText) {
            throw new ValidationError('任务内容不能为空');
        }
        if (trimmedText.length > config.maxTodoLength) {
            throw new ValidationError(`任务内容不能超过 ${config.maxTodoLength} 个字符`);
        }
    }
    addTodo(text, listId) {
        this.validateTodoText(text);
        const targetListId = listId || this.getTargetListId();
        const newTodo = {
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
    getTargetListId() {
        if (['my-day', 'important', 'planned', 'all'].includes(this.currentListId)) {
            return 'tasks';
        }
        return this.currentListId;
    }
    toggleTodo(id) {
        const todo = this.todos.find(t => t.id === id);
        if (todo) {
            todo.completed = !todo.completed;
            this.save();
            return todo;
        }
        return null;
    }
    deleteTodo(id) {
        const index = this.todos.findIndex(t => t.id === id);
        if (index !== -1) {
            this.todos.splice(index, 1);
            this.save();
            return true;
        }
        return false;
    }
    updateTodoText(id, text) {
        const todo = this.todos.find(t => t.id === id);
        if (todo && text.trim()) {
            todo.text = text.trim();
            this.save();
            return true;
        }
        return false;
    }
    toggleImportant(id) {
        const todo = this.todos.find(t => t.id === id);
        if (todo) {
            todo.isImportant = !todo.isImportant;
            this.save();
            return true;
        }
        return false;
    }
    updateDueDate(id, dueDate) {
        const todo = this.todos.find(t => t.id === id);
        if (todo) {
            todo.dueDate = dueDate;
            this.save();
            return true;
        }
        return false;
    }
    updateNote(id, note) {
        const todo = this.todos.find(t => t.id === id);
        if (todo) {
            todo.note = note;
            this.save();
            return true;
        }
        return false;
    }
    addSubtask(todoId, text) {
        const todo = this.todos.find(t => t.id === todoId);
        if (todo && text.trim()) {
            const subtask = {
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
    toggleSubtask(todoId, subtaskId) {
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
    getTodoById(id) {
        return this.todos.find(t => t.id === id);
    }
    getFilteredTodos(filter) {
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
    getCurrentListTodos() {
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
    getMyDayTodos() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        return this.todos.filter(todo => {
            if (todo.dueDate) {
                const dueDate = new Date(todo.dueDate);
                dueDate.setHours(0, 0, 0, 0);
                if (dueDate.getTime() === today.getTime()) {
                    return true;
                }
            }
            if (todo.isImportant && !todo.completed) {
                return true;
            }
            return false;
        });
    }
    getStats() {
        const completed = this.todos.filter(t => t.completed).length;
        return {
            completed,
            total: this.todos.length,
            important: this.todos.filter(t => t.isImportant).length,
            planned: this.todos.filter(t => t.dueDate).length
        };
    }
    getSmartListCounts() {
        return {
            myDay: this.getMyDayTodos().filter(t => !t.completed).length,
            important: this.todos.filter(t => t.isImportant && !t.completed).length,
            planned: this.todos.filter(t => t.dueDate && !t.completed).length,
            all: this.todos.filter(t => !t.completed).length
        };
    }
    getTheme() {
        return this.currentTheme;
    }
    setTheme(theme) {
        this.currentTheme = theme;
        this.save();
    }
    getCurrentListId() {
        return this.currentListId;
    }
    setCurrentList(listId) {
        this.currentListId = listId;
        this.save();
    }
    getListById(id) {
        return this.lists.find(l => l.id === id);
    }
    getCustomLists() {
        return this.lists.filter(l => !l.isSmart);
    }
    addList(name) {
        const newList = {
            id: this.generateId(),
            name: name.trim(),
            icon: 'list'
        };
        this.lists.push(newList);
        this.save();
        return newList;
    }
    getListCount(listId) {
        if (listId === 'all') {
            return this.todos.filter(t => !t.completed).length;
        }
        return this.todos.filter(t => t.listId === listId && !t.completed).length;
    }
    save() {
        const data = {
            todos: this.todos,
            lists: this.lists,
            currentListId: this.currentListId,
            theme: this.currentTheme
        };
        this.storage.save(data);
    }
    clearAll() {
        this.todos = [];
        this.save();
    }
}
//# sourceMappingURL=todoManager.js.map