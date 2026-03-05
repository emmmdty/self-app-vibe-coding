import { Todo, TodoList, TodoStats, Theme, FilterType, SubTask } from './types.js';
export declare class TodoManager {
    private todos;
    private lists;
    private storage;
    private currentTheme;
    private currentListId;
    constructor();
    private getDefaultLists;
    private generateId;
    private validateTodoText;
    addTodo(text: string, listId?: string): Todo;
    private getTargetListId;
    toggleTodo(id: string): Todo | null;
    deleteTodo(id: string): boolean;
    updateTodoText(id: string, text: string): boolean;
    toggleImportant(id: string): boolean;
    updateDueDate(id: string, dueDate?: number): boolean;
    updateNote(id: string, note: string): boolean;
    addSubtask(todoId: string, text: string): SubTask | null;
    toggleSubtask(todoId: string, subtaskId: string): boolean;
    getTodoById(id: string): Todo | undefined;
    getFilteredTodos(filter: FilterType): Todo[];
    private getCurrentListTodos;
    private getMyDayTodos;
    getStats(): TodoStats;
    getSmartListCounts(): {
        myDay: number;
        important: number;
        planned: number;
        all: number;
    };
    getTheme(): Theme;
    setTheme(theme: Theme): void;
    getCurrentListId(): string;
    setCurrentList(listId: string): void;
    getListById(id: string): TodoList | undefined;
    getCustomLists(): TodoList[];
    addList(name: string): TodoList;
    getListCount(listId: string): number;
    private save;
    clearAll(): void;
}
//# sourceMappingURL=todoManager.d.ts.map