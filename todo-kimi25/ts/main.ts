import { Todo, Theme, DeviceType, FilterType, ValidationError } from './types.js';
import { TodoManager } from './todoManager.js';
import { Storage } from './storage.js';
import { getKeyboardManager } from './keyboardManager.js';

class TodoApp {
    private todoManager: TodoManager;
    private storage: Storage;
    private keyboardManager = getKeyboardManager();

    // DOM元素
    private todoInput!: HTMLInputElement;
    private todoForm!: HTMLFormElement;
    private todoList!: HTMLUListElement;
    private completedList!: HTMLUListElement;
    private emptyState!: HTMLDivElement;
    private completedToggle!: HTMLButtonElement;
    private completedCount!: HTMLSpanElement;
    private filterTabs!: NodeListOf<HTMLButtonElement>;
    private themeButtons!: NodeListOf<HTMLButtonElement>;
    private deviceButtons!: NodeListOf<HTMLButtonElement>;
    private customColorPicker!: HTMLInputElement;
    private appContainer!: HTMLDivElement;
    private detailPanel!: HTMLElement;
    private navButtons!: NodeListOf<HTMLButtonElement>;
    private listTitle!: HTMLHeadingElement;
    private listDate!: HTMLSpanElement;
    private addListBtn!: HTMLButtonElement;
    private customListsContainer!: HTMLUListElement;
    private closeDetailBtn!: HTMLButtonElement;

    // 详情面板元素
    private detailCheckbox!: HTMLInputElement;
    private detailTaskText!: HTMLInputElement;
    private detailImportantBtn!: HTMLButtonElement;
    private detailDueDate!: HTMLInputElement;
    private detailNote!: HTMLTextAreaElement;
    private subtasksList!: HTMLDivElement;
    private addSubtaskInput!: HTMLInputElement;
    private addSubtaskBtn!: HTMLButtonElement;
    private detailCreated!: HTMLSpanElement;
    private deleteTaskBtn!: HTMLButtonElement;

    // 状态
    private currentFilter: FilterType = 'all';
    private selectedTodoId: string | null = null;

    constructor() {
        this.storage = Storage.getInstance();
        
        if (!this.storage.isAvailable()) {
            alert('您的浏览器不支持本地存储，数据将无法保存');
        }

        this.todoManager = new TodoManager();
        this.initializeElements();
        this.bindEvents();
        this.setupKeyboardShortcuts();
        this.applyTheme(this.todoManager.getTheme());
        this.updateListDate();
        this.render();
    }

    /**
     * 设置键盘快捷键
     */
    private setupKeyboardShortcuts(): void {
        // 新建任务
        this.keyboardManager.registerShortcut({
            key: 'n',
            ctrl: true,
            handler: () => {
                this.todoInput.focus();
                this.showNotification('新建任务 (Ctrl+N)', 'success');
            },
            description: '新建任务'
        });

        // 完成任务（选中状态下）
        this.keyboardManager.registerShortcut({
            key: ' ',
            handler: () => {
                if (this.selectedTodoId && document.activeElement !== this.todoInput) {
                    this.todoManager.toggleTodo(this.selectedTodoId);
                    this.render();
                    this.updateDetailPanel();
                    this.showNotification('切换完成状态', 'success');
                }
            },
            description: '切换任务完成状态'
        });

        // 标记重要
        this.keyboardManager.registerShortcut({
            key: 'i',
            ctrl: true,
            handler: () => {
                if (this.selectedTodoId) {
                    this.todoManager.toggleImportant(this.selectedTodoId);
                    this.updateDetailPanel();
                    this.render();
                    this.showNotification('切换重要状态', 'success');
                }
            },
            description: '切换重要状态'
        });

        // 删除任务
        this.keyboardManager.registerShortcut({
            key: 'Delete',
            handler: () => {
                if (this.selectedTodoId && document.activeElement !== this.todoInput) {
                    this.todoManager.deleteTodo(this.selectedTodoId);
                    this.closeDetailPanel();
                    this.render();
                    this.showNotification('任务已删除', 'success');
                }
            },
            description: '删除任务'
        });

        // 关闭详情面板
        this.keyboardManager.registerShortcut({
            key: 'Escape',
            handler: () => {
                if (this.selectedTodoId) {
                    this.closeDetailPanel();
                }
            },
            description: '关闭详情面板'
        });

        // 切换筛选 - 全部
        this.keyboardManager.registerShortcut({
            key: '1',
            ctrl: true,
            handler: () => this.handleFilterChange('all'),
            description: '筛选：全部'
        });

        // 切换筛选 - 进行中
        this.keyboardManager.registerShortcut({
            key: '2',
            ctrl: true,
            handler: () => this.handleFilterChange('active'),
            description: '筛选：进行中'
        });

        // 切换筛选 - 已完成
        this.keyboardManager.registerShortcut({
            key: '3',
            ctrl: true,
            handler: () => this.handleFilterChange('completed'),
            description: '筛选：已完成'
        });

        // 搜索/聚焦输入框
        this.keyboardManager.registerShortcut({
            key: 'f',
            ctrl: true,
            handler: () => {
                this.todoInput.focus();
                this.showNotification('搜索任务 (Ctrl+F)', 'success');
            },
            description: '搜索任务'
        });

        // 帮助
        this.keyboardManager.registerShortcut({
            key: '?',
            shift: true,
            handler: () => {
                this.showShortcutsHelp();
            },
            description: '显示快捷键帮助'
        });
    }

    /**
     * 显示快捷键帮助
     */
    private showShortcutsHelp(): void {
        const shortcuts = this.keyboardManager.getShortcuts();
        const helpText = shortcuts.map(s => `${s.key}: ${s.description}`).join('\n');
        alert('键盘快捷键：\n\n' + helpText);
    }

    private initializeElements(): void {
        // 主内容区
        this.todoInput = document.getElementById('todo-input') as HTMLInputElement;
        this.todoForm = document.getElementById('todo-form') as HTMLFormElement;
        this.todoList = document.getElementById('todo-list') as HTMLUListElement;
        this.completedList = document.getElementById('completed-list') as HTMLUListElement;
        this.emptyState = document.getElementById('empty-state') as HTMLDivElement;
        this.completedToggle = document.getElementById('completed-toggle') as HTMLButtonElement;
        this.completedCount = document.getElementById('completed-count') as HTMLSpanElement;
        this.filterTabs = document.querySelectorAll('.filter-tab') as NodeListOf<HTMLButtonElement>;
        this.themeButtons = document.querySelectorAll('.theme-btn') as NodeListOf<HTMLButtonElement>;
        this.deviceButtons = document.querySelectorAll('.device-btn') as NodeListOf<HTMLButtonElement>;
        this.customColorPicker = document.getElementById('custom-color') as HTMLInputElement;
        this.appContainer = document.getElementById('app-container') as HTMLDivElement;
        this.detailPanel = document.getElementById('detail-panel') as HTMLElement;
        this.navButtons = document.querySelectorAll('.nav-btn') as NodeListOf<HTMLButtonElement>;
        this.listTitle = document.getElementById('list-title') as HTMLHeadingElement;
        this.listDate = document.getElementById('list-date') as HTMLSpanElement;
        this.addListBtn = document.getElementById('add-list-btn') as HTMLButtonElement;
        this.customListsContainer = document.getElementById('custom-lists') as HTMLUListElement;
        this.closeDetailBtn = document.getElementById('close-detail-btn') as HTMLButtonElement;
        
        // 详情面板元素
        this.detailCheckbox = document.getElementById('detail-checkbox') as HTMLInputElement;
        this.detailTaskText = document.getElementById('detail-task-text') as HTMLInputElement;
        this.detailImportantBtn = document.getElementById('detail-important-btn') as HTMLButtonElement;
        this.detailDueDate = document.getElementById('detail-due-date') as HTMLInputElement;
        this.detailNote = document.getElementById('detail-note') as HTMLTextAreaElement;
        this.subtasksList = document.getElementById('subtasks-list') as HTMLDivElement;
        this.addSubtaskInput = document.getElementById('add-subtask-input') as HTMLInputElement;
        this.addSubtaskBtn = document.getElementById('add-subtask-btn') as HTMLButtonElement;
        this.detailCreated = document.getElementById('detail-created') as HTMLSpanElement;
        this.deleteTaskBtn = document.getElementById('delete-task-btn') as HTMLButtonElement;
    }

    private bindEvents(): void {
        // 表单提交 - 使用防抖
        this.todoForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.debounce('submit', () => this.handleAddTodo());
        });

        // 筛选标签 - 使用防抖防止快速切换
        this.filterTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const filter = tab.dataset.filter as FilterType;
                this.debounce(`filter-${filter}`, () => this.handleFilterChange(filter));
            });
        });

        // 主题切换 - 使用节流
        this.themeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const theme = btn.dataset.theme as Theme;
                this.throttle(`theme-${theme}`, () => this.handleThemeChange(theme));
            });
        });

        // 设备切换 - 使用节流
        this.deviceButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const device = btn.dataset.device as DeviceType;
                this.throttle(`device-${device}`, () => this.handleDeviceChange(device));
            });
        });

        // 自定义颜色 - 使用节流
        this.customColorPicker.addEventListener('input', (e) => {
            const color = (e.target as HTMLInputElement).value;
            this.throttle('color-change', () => this.applyCustomColor(color));
        });

        // 导航列表切换 - 使用防抖
        this.navButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const listId = btn.dataset.listId as string;
                this.debounce(`nav-${listId}`, () => this.handleListChange(listId, btn));
            });
        });

        // 已完成任务折叠
        this.completedToggle.addEventListener('click', () => {
            this.debounce('toggle-completed', () => this.toggleCompletedSection());
        });

        // 新建列表
        this.addListBtn.addEventListener('click', () => {
            this.debounce('add-list', () => this.handleAddList());
        });

        // 关闭详情面板
        this.closeDetailBtn.addEventListener('click', () => {
            this.debounce('close-detail', () => this.closeDetailPanel());
        });

        // 详情面板事件 - 使用状态锁防止重复触发
        this.detailCheckbox.addEventListener('change', () => {
            this.withLock('detail-checkbox', () => {
                if (this.selectedTodoId) {
                    this.todoManager.toggleTodo(this.selectedTodoId);
                    this.render();
                    this.updateDetailPanel();
                }
            });
        });

        this.detailTaskText.addEventListener('blur', () => {
            this.debounce('update-text', () => {
                if (this.selectedTodoId) {
                    this.todoManager.updateTodoText(this.selectedTodoId, this.detailTaskText.value);
                    this.render();
                }
            });
        });

        this.detailImportantBtn.addEventListener('click', () => {
            this.withLock('detail-important', () => {
                if (this.selectedTodoId) {
                    this.todoManager.toggleImportant(this.selectedTodoId);
                    this.updateDetailPanel();
                    this.render();
                }
            });
        });

        this.detailDueDate.addEventListener('change', () => {
            this.debounce('update-due-date', () => {
                if (this.selectedTodoId) {
                    const date = this.detailDueDate.value ? new Date(this.detailDueDate.value).getTime() : undefined;
                    this.todoManager.updateDueDate(this.selectedTodoId, date);
                    this.render();
                }
            });
        });

        this.detailNote.addEventListener('blur', () => {
            this.debounce('update-note', () => {
                if (this.selectedTodoId) {
                    this.todoManager.updateNote(this.selectedTodoId, this.detailNote.value);
                }
            });
        });

        this.addSubtaskBtn.addEventListener('click', () => {
            this.debounce('add-subtask', () => this.handleAddSubtask());
        });

        this.addSubtaskInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.debounce('add-subtask-enter', () => this.handleAddSubtask());
            }
        });

        this.deleteTaskBtn.addEventListener('click', () => {
            this.withLock('delete-task', () => {
                if (this.selectedTodoId) {
                    this.todoManager.deleteTodo(this.selectedTodoId);
                    this.closeDetailPanel();
                    this.render();
                    this.showNotification('任务已删除', 'success');
                }
            });
        });
    }

    // ==================== 性能优化工具方法 ====================

    private debounceTimers: Map<string, number> = new Map();
    private throttleTimers: Map<string, number> = new Map();
    private throttleLastExec: Map<string, number> = new Map();
    private operationLocks: Map<string, boolean> = new Map();

    /**
     * 防抖函数
     * @param key 防抖标识
     * @param callback 回调函数
     * @param delay 延迟时间（默认150ms）
     */
    private debounce(key: string, callback: () => void, delay = 150): void {
        // 清除之前的定时器
        if (this.debounceTimers.has(key)) {
            clearTimeout(this.debounceTimers.get(key));
        }

        // 设置新的定时器
        const timer = window.setTimeout(() => {
            callback();
            this.debounceTimers.delete(key);
        }, delay);

        this.debounceTimers.set(key, timer);
    }

    /**
     * 节流函数
     * @param key 节流标识
     * @param callback 回调函数
     * @param delay 延迟时间（默认100ms）
     */
    private throttle(key: string, callback: () => void, delay = 100): void {
        const now = Date.now();
        const lastExec = this.throttleLastExec.get(key) || 0;

        // 如果距离上次执行已经超过节流延迟，立即执行
        if (now - lastExec >= delay) {
            this.throttleLastExec.set(key, now);
            callback();
            return;
        }

        // 否则设置定时器
        if (!this.throttleTimers.has(key)) {
            const timer = window.setTimeout(() => {
                this.throttleLastExec.set(key, Date.now());
                callback();
                this.throttleTimers.delete(key);
            }, delay - (now - lastExec));

            this.throttleTimers.set(key, timer);
        }
    }

    /**
     * 状态锁 - 防止重复触发
     * @param key 锁标识
     * @param callback 回调函数
     */
    private withLock(key: string, callback: () => void): void {
        // 检查是否已锁定
        if (this.operationLocks.get(key)) {
            return; // 如果正在处理，直接返回
        }

        // 加锁
        this.operationLocks.set(key, true);

        try {
            callback();
        } finally {
            // 使用 requestAnimationFrame 确保在下一帧解锁
            requestAnimationFrame(() => {
                this.operationLocks.set(key, false);
            });
        }
    }

    private handleAddTodo(): void {
        const text = this.todoInput.value.trim();
        if (!text) return;

        try {
            this.todoManager.addTodo(text);
            this.todoInput.value = '';
            this.todoInput.focus();
            this.render();
        } catch (error) {
            if (error instanceof ValidationError) {
                this.showNotification(error.message, 'error');
            }
        }
    }

    private handleFilterChange(filter: FilterType): void {
        this.currentFilter = filter;
        this.filterTabs.forEach(tab => {
            tab.classList.toggle('active', tab.dataset.filter === filter);
        });
        this.render();
    }

    private handleThemeChange(theme: Theme): void {
        this.todoManager.setTheme(theme);
        this.applyTheme(theme);
    }

    private handleDeviceChange(device: DeviceType): void {
        this.appContainer.className = 'app-wrapper';
        this.appContainer.classList.add(`device-${device}`);
        
        this.deviceButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.device === device);
        });
    }

    private handleListChange(listId: string, btn: HTMLButtonElement): void {
        this.todoManager.setCurrentList(listId);
        
        this.navButtons.forEach(navBtn => {
            navBtn.classList.remove('active');
        });
        btn.classList.add('active');
        
        const list = this.todoManager.getListById(listId);
        if (list) {
            this.listTitle.textContent = list.name;
        }
        
        this.render();
    }

    private handleAddList(): void {
        const name = prompt('请输入列表名称');
        if (name && name.trim()) {
            this.todoManager.addList(name.trim());
            this.renderCustomLists();
        }
    }

    private handleAddSubtask(): void {
        const text = this.addSubtaskInput.value.trim();
        if (!text || !this.selectedTodoId) return;

        this.todoManager.addSubtask(this.selectedTodoId, text);
        this.addSubtaskInput.value = '';
        this.renderSubtasks();
        this.render();
    }

    private toggleCompletedSection(): void {
        this.completedToggle.classList.toggle('expanded');
        this.completedList.classList.toggle('show');
    }

    private openDetailPanel(todoId: string): void {
        this.selectedTodoId = todoId;
        this.detailPanel.classList.add('open');
        this.updateDetailPanel();
    }

    private closeDetailPanel(): void {
        this.selectedTodoId = null;
        this.detailPanel.classList.remove('open');
    }

    private updateDetailPanel(): void {
        if (!this.selectedTodoId) return;

        const todo = this.todoManager.getTodoById(this.selectedTodoId);
        if (!todo) return;

        this.detailCheckbox.checked = todo.completed;
        this.detailTaskText.value = todo.text;
        this.detailImportantBtn.classList.toggle('active', todo.isImportant);
        this.detailDueDate.value = todo.dueDate ? new Date(todo.dueDate).toISOString().split('T')[0] : '';
        this.detailNote.value = todo.note || '';
        this.detailCreated.textContent = `创建于 ${new Date(todo.createdAt).toLocaleDateString('zh-CN')}`;
        
        this.renderSubtasks();
    }

    private renderSubtasks(): void {
        if (!this.selectedTodoId) return;

        const todo = this.todoManager.getTodoById(this.selectedTodoId);
        if (!todo) return;

        this.subtasksList.innerHTML = '';
        todo.subTasks.forEach(subtask => {
            const div = document.createElement('div');
            div.className = `subtask-item ${subtask.completed ? 'completed' : ''}`;
            div.innerHTML = `
                <input type="checkbox" class="subtask-checkbox" ${subtask.completed ? 'checked' : ''}>
                <span class="subtask-text">${this.escapeHtml(subtask.text)}</span>
            `;
            
            const checkbox = div.querySelector('.subtask-checkbox') as HTMLInputElement;
            checkbox.addEventListener('change', () => {
                this.todoManager.toggleSubtask(this.selectedTodoId!, subtask.id);
                this.renderSubtasks();
                this.render();
            });
            
            this.subtasksList.appendChild(div);
        });
    }

    private applyTheme(theme: Theme): void {
        document.body.setAttribute('data-theme', theme);
        document.body.style.removeProperty('--primary-color');
        document.body.style.removeProperty('--primary-light');
        document.body.style.removeProperty('--primary-dark');
        document.body.style.removeProperty('--primary-gradient');
        document.body.style.removeProperty('--background');
        document.body.style.removeProperty('--shadow-glow');
        
        this.themeButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.theme === theme);
        });
    }

    private applyCustomColor(color: string): void {
        document.body.removeAttribute('data-theme');
        this.themeButtons.forEach(btn => {
            btn.classList.remove('active');
        });
        
        document.body.style.setProperty('--primary-color', color);
        document.body.style.setProperty('--primary-light', this.lightenColor(color, 20));
        document.body.style.setProperty('--primary-dark', this.darkenColor(color, 20));
    }

    private lightenColor(hex: string, percent: number): string {
        const num = parseInt(hex.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = Math.min(255, (num >> 16) + amt);
        const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
        const B = Math.min(255, (num & 0x0000FF) + amt);
        return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
    }

    private darkenColor(hex: string, percent: number): string {
        const num = parseInt(hex.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = Math.max(0, (num >> 16) - amt);
        const G = Math.max(0, ((num >> 8) & 0x00FF) - amt);
        const B = Math.max(0, (num & 0x0000FF) - amt);
        return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
    }

    private updateListDate(): void {
        const date = new Date();
        const options: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'long', day: 'numeric' };
        this.listDate.textContent = date.toLocaleDateString('zh-CN', options);
    }

    private render(): void {
        // 获取当前列表的所有任务（不过滤完成状态）
        const allTodos = this.todoManager.getFilteredTodos('all');
        const activeTodos = allTodos.filter(t => !t.completed);
        const completedTodos = allTodos.filter(t => t.completed);
        
        // 根据当前筛选决定显示哪些进行中的任务
        let displayActiveTodos = activeTodos;
        if (this.currentFilter === 'important') {
            displayActiveTodos = activeTodos.filter(t => t.isImportant);
        }
        
        // 渲染进行中的任务
        this.todoList.innerHTML = '';
        displayActiveTodos.forEach(todo => {
            this.todoList.appendChild(this.createTodoElement(todo));
        });
        
        // 渲染已完成的任务（不受筛选影响，始终显示）
        this.completedList.innerHTML = '';
        completedTodos.forEach(todo => {
            this.completedList.appendChild(this.createTodoElement(todo));
        });
        
        // 更新已完成任务计数
        this.completedCount.textContent = String(completedTodos.length);
        
        // 显示/隐藏空状态
        const hasVisibleTasks = displayActiveTodos.length > 0 || completedTodos.length > 0;
        this.emptyState.classList.toggle('show', !hasVisibleTasks);
        
        // 显示/隐藏已完成区域
        const completedSection = document.getElementById('completed-section') as HTMLElement;
        if (completedSection) {
            completedSection.style.display = completedTodos.length > 0 ? 'block' : 'none';
        }
        
        // 更新导航计数
        this.updateNavCounts();
        
        // 渲染自定义列表
        this.renderCustomLists();
    }

    private createTodoElement(todo: Todo): HTMLLIElement {
        const li = document.createElement('li');
        li.className = `todo-item ${todo.completed ? 'completed' : ''} ${todo.id === this.selectedTodoId ? 'selected' : ''}`;
        li.dataset.id = todo.id;
        
        const dueDateText = this.getDueDateText(todo.dueDate);
        const dueDateClass = this.getDueDateClass(todo.dueDate);
        
        li.innerHTML = `
            <div class="todo-checkbox-wrapper">
                <input type="checkbox" class="todo-checkbox" ${todo.completed ? 'checked' : ''}>
                <span class="checkmark"></span>
            </div>
            <div class="todo-content">
                <div class="todo-text">${this.escapeHtml(todo.text)}</div>
                ${dueDateText ? `
                    <div class="todo-meta">
                        <span class="todo-due-date ${dueDateClass}">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                                <line x1="16" y1="2" x2="16" y2="6"/>
                                <line x1="8" y1="2" x2="8" y2="6"/>
                                <line x1="3" y1="10" x2="21" y2="10"/>
                            </svg>
                            ${dueDateText}
                        </span>
                        ${todo.subTasks.length > 0 ? `<span>${todo.subTasks.filter(s => s.completed).length}/${todo.subTasks.length}</span>` : ''}
                    </div>
                ` : ''}
            </div>
            <button class="star-btn ${todo.isImportant ? 'active' : ''}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
            </button>
        `;
        
        // 事件绑定
        const checkbox = li.querySelector('.todo-checkbox') as HTMLInputElement;
        checkbox.addEventListener('change', () => {
            this.todoManager.toggleTodo(todo.id);
            this.render();
        });
        
        const starBtn = li.querySelector('.star-btn') as HTMLButtonElement;
        starBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.todoManager.toggleImportant(todo.id);
            this.render();
        });
        
        li.addEventListener('click', () => {
            this.openDetailPanel(todo.id);
        });
        
        return li;
    }

    private getDueDateText(dueDate?: number): string {
        if (!dueDate) return '';
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const due = new Date(dueDate);
        due.setHours(0, 0, 0, 0);
        
        const diffDays = Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) return '今天';
        if (diffDays === 1) return '明天';
        if (diffDays === -1) return '昨天';
        if (diffDays < -1) return `${Math.abs(diffDays)}天前`;
        if (diffDays > 1) return `${diffDays}天后`;
        
        return due.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
    }

    private getDueDateClass(dueDate?: number): string {
        if (!dueDate) return '';
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const due = new Date(dueDate);
        due.setHours(0, 0, 0, 0);
        
        const diffDays = Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        if (diffDays < 0) return 'overdue';
        if (diffDays === 0) return 'today';
        return '';
    }

    private renderCustomLists(): void {
        const lists = this.todoManager.getCustomLists();
        this.customListsContainer.innerHTML = '';
        
        lists.forEach(list => {
            const li = document.createElement('li');
            li.className = 'nav-item';
            li.innerHTML = `
                <button class="nav-btn ${list.id === this.todoManager.getCurrentListId() ? 'active' : ''}" data-list-id="${list.id}">
                    <span class="nav-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                        </svg>
                    </span>
                    <span class="nav-text">${this.escapeHtml(list.name)}</span>
                    <span class="nav-count">${this.todoManager.getListCount(list.id)}</span>
                </button>
            `;
            
            const btn = li.querySelector('.nav-btn') as HTMLButtonElement;
            btn.addEventListener('click', () => {
                this.handleListChange(list.id, btn);
            });
            
            this.customListsContainer.appendChild(li);
        });
    }

    private updateNavCounts(): void {
        const counts = this.todoManager.getSmartListCounts();
        
        const myDayCount = document.getElementById('count-my-day');
        const importantCount = document.getElementById('count-important');
        const plannedCount = document.getElementById('count-planned');
        const allCount = document.getElementById('count-all');
        
        if (myDayCount) myDayCount.textContent = String(counts.myDay);
        if (importantCount) importantCount.textContent = String(counts.important);
        if (plannedCount) plannedCount.textContent = String(counts.planned);
        if (allCount) allCount.textContent = String(counts.all);
    }

    private escapeHtml(text: string): string {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    private showNotification(message: string, type: 'success' | 'error'): void {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        requestAnimationFrame(() => {
            notification.classList.add('show');
        });
        
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 2000);
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    new TodoApp();
});
