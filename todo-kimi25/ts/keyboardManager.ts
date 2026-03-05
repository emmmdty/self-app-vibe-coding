/**
 * 键盘事件管理器
 * 提供防抖、节流、按键状态管理和快捷键支持
 */

interface KeyState {
    isPressed: boolean;
    pressedAt: number;
    lastRepeatAt: number;
}

interface ShortcutConfig {
    key: string;
    ctrl?: boolean;
    alt?: boolean;
    shift?: boolean;
    meta?: boolean;
    handler: () => void;
    description: string;
}

export class KeyboardManager {
    private keyStates: Map<string, KeyState> = new Map();
    private shortcuts: Map<string, ShortcutConfig> = new Map();
    private debounceTimers: Map<string, number> = new Map();
    private throttleTimers: Map<string, number> = new Map();
    private throttleLastExec: Map<string, number> = new Map();
    
    // 配置参数
    private debounceDelay = 150; // 防抖延迟（毫秒）
    private throttleDelay = 100; // 节流延迟（毫秒）
    private repeatDelay = 500; // 长按重复延迟（毫秒）
    private repeatInterval = 50; // 长按重复间隔（毫秒）
    
    // 需要防抖的按键
    private debounceKeys = new Set(['Enter', ' ', 'Escape']);
    // 需要节流的按键
    private throttleKeys = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
    
    private isActive = true;

    constructor() {
        this.bindGlobalEvents();
    }

    /**
     * 绑定全局键盘事件
     */
    private bindGlobalEvents(): void {
        // 使用 capture 阶段确保优先处理
        document.addEventListener('keydown', this.handleKeyDown.bind(this), true);
        document.addEventListener('keyup', this.handleKeyUp.bind(this), true);
        
        // 防止默认行为的按键
        document.addEventListener('keydown', (e) => {
            if (this.shouldPreventDefault(e)) {
                e.preventDefault();
            }
        }, true);

        // 页面失去焦点时重置所有按键状态
        window.addEventListener('blur', () => {
            this.resetAllKeyStates();
        });

        // 可见性变化时暂停/恢复
        document.addEventListener('visibilitychange', () => {
            this.isActive = document.visibilityState === 'visible';
            if (!this.isActive) {
                this.resetAllKeyStates();
            }
        });
    }

    /**
     * 处理按键按下事件
     */
    private handleKeyDown(e: KeyboardEvent): void {
        if (!this.isActive) return;

        const key = e.key;
        const now = Date.now();
        
        // 更新按键状态
        this.updateKeyState(key, true, now);
        
        // 检查快捷键
        const shortcutKey = this.getShortcutKey(e);
        if (this.shortcuts.has(shortcutKey)) {
            e.preventDefault();
            e.stopPropagation();
            this.executeShortcut(shortcutKey);
            return;
        }

        // 防抖处理
        if (this.debounceKeys.has(key)) {
            this.handleDebounce(key, () => this.emitKeyEvent('keydown', e));
            return;
        }

        // 节流处理
        if (this.throttleKeys.has(key)) {
            this.handleThrottle(key, () => this.emitKeyEvent('keydown', e));
            return;
        }

        // 普通按键直接触发
        this.emitKeyEvent('keydown', e);

        // 处理长按重复
        this.handleKeyRepeat(key, e);
    }

    /**
     * 处理按键释放事件
     */
    private handleKeyUp(e: KeyboardEvent): void {
        const key = e.key;
        
        // 更新按键状态
        this.updateKeyState(key, false, Date.now());
        
        // 清除防抖定时器
        if (this.debounceTimers.has(key)) {
            clearTimeout(this.debounceTimers.get(key));
            this.debounceTimers.delete(key);
        }

        // 触发释放事件
        this.emitKeyEvent('keyup', e);
    }

    /**
     * 更新按键状态
     */
    private updateKeyState(key: string, isPressed: boolean, timestamp: number): void {
        const state = this.keyStates.get(key);
        
        if (isPressed) {
            if (!state || !state.isPressed) {
                // 按键刚按下
                this.keyStates.set(key, {
                    isPressed: true,
                    pressedAt: timestamp,
                    lastRepeatAt: timestamp
                });
            }
        } else {
            // 按键释放
            if (state) {
                state.isPressed = false;
            }
        }
    }

    /**
     * 防抖处理
     */
    private handleDebounce(key: string, callback: () => void): void {
        // 清除之前的定时器
        if (this.debounceTimers.has(key)) {
            clearTimeout(this.debounceTimers.get(key));
        }

        // 设置新的定时器
        const timer = window.setTimeout(() => {
            callback();
            this.debounceTimers.delete(key);
        }, this.debounceDelay);

        this.debounceTimers.set(key, timer);
    }

    /**
     * 节流处理
     */
    private handleThrottle(key: string, callback: () => void): void {
        const now = Date.now();
        const lastExec = this.throttleLastExec.get(key) || 0;

        // 如果距离上次执行已经超过节流延迟，立即执行
        if (now - lastExec >= this.throttleDelay) {
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
            }, this.throttleDelay - (now - lastExec));
            
            this.throttleTimers.set(key, timer);
        }
    }

    /**
     * 处理按键长按重复
     */
    private handleKeyRepeat(key: string, e: KeyboardEvent): void {
        // 浏览器会自动处理重复按键，这里添加自定义逻辑
        const state = this.keyStates.get(key);
        if (!state) return;

        // 使用 requestAnimationFrame 优化性能
        let repeatFrame: number;
        
        const checkRepeat = () => {
            const currentState = this.keyStates.get(key);
            if (!currentState || !currentState.isPressed) {
                cancelAnimationFrame(repeatFrame);
                return;
            }

            const now = Date.now();
            const pressedDuration = now - currentState.pressedAt;
            const timeSinceLastRepeat = now - currentState.lastRepeatAt;

            // 超过重复延迟后，按间隔触发
            if (pressedDuration > this.repeatDelay && timeSinceLastRepeat > this.repeatInterval) {
                currentState.lastRepeatAt = now;
                this.emitKeyEvent('keyrepeat', e);
            }

            repeatFrame = requestAnimationFrame(checkRepeat);
        };

        repeatFrame = requestAnimationFrame(checkRepeat);
    }

    /**
     * 获取快捷键标识
     */
    private getShortcutKey(e: KeyboardEvent): string {
        const parts: string[] = [];
        
        if (e.ctrlKey) parts.push('Ctrl');
        if (e.altKey) parts.push('Alt');
        if (e.shiftKey) parts.push('Shift');
        if (e.metaKey) parts.push('Meta');
        parts.push(e.key);
        
        return parts.join('+');
    }

    /**
     * 执行快捷键
     */
    private executeShortcut(shortcutKey: string): void {
        const shortcut = this.shortcuts.get(shortcutKey);
        if (shortcut) {
            // 使用 requestIdleCallback 优化性能
            if ('requestIdleCallback' in window) {
                requestIdleCallback(() => shortcut.handler(), { timeout: 100 });
            } else {
                setTimeout(shortcut.handler, 0);
            }
        }
    }

    /**
     * 触发键盘事件
     */
    private emitKeyEvent(type: string, e: KeyboardEvent): void {
        // 创建自定义事件
        const event = new CustomEvent('keyboard', {
            detail: {
                type,
                key: e.key,
                code: e.code,
                ctrlKey: e.ctrlKey,
                altKey: e.altKey,
                shiftKey: e.shiftKey,
                metaKey: e.metaKey,
                originalEvent: e
            }
        });
        
        document.dispatchEvent(event);
    }

    /**
     * 判断是否阻止默认行为
     */
    private shouldPreventDefault(e: KeyboardEvent): boolean {
        // 阻止可能导致页面滚动的快捷键
        if (e.ctrlKey || e.metaKey) {
            const blockedKeys = ['s', 'p', 'f', 'h'];
            if (blockedKeys.includes(e.key.toLowerCase())) {
                return true;
            }
        }
        return false;
    }

    /**
     * 重置所有按键状态
     */
    private resetAllKeyStates(): void {
        this.keyStates.clear();
        
        // 清除所有定时器
        this.debounceTimers.forEach(timer => clearTimeout(timer));
        this.debounceTimers.clear();
        
        this.throttleTimers.forEach(timer => clearTimeout(timer));
        this.throttleTimers.clear();
    }

    // ==================== 公共 API ====================

    /**
     * 注册快捷键
     */
    registerShortcut(config: ShortcutConfig): void {
        const key = [
            config.ctrl ? 'Ctrl' : '',
            config.alt ? 'Alt' : '',
            config.shift ? 'Shift' : '',
            config.meta ? 'Meta' : '',
            config.key
        ].filter(Boolean).join('+');

        this.shortcuts.set(key, config);
    }

    /**
     * 注销快捷键
     */
    unregisterShortcut(key: string): void {
        this.shortcuts.delete(key);
    }

    /**
     * 检查按键是否按下
     */
    isKeyPressed(key: string): boolean {
        const state = this.keyStates.get(key);
        return state ? state.isPressed : false;
    }

    /**
     * 获取按键按下时长
     */
    getKeyPressDuration(key: string): number {
        const state = this.keyStates.get(key);
        if (state && state.isPressed) {
            return Date.now() - state.pressedAt;
        }
        return 0;
    }

    /**
     * 设置防抖延迟
     */
    setDebounceDelay(delay: number): void {
        this.debounceDelay = Math.max(0, delay);
    }

    /**
     * 设置节流延迟
     */
    setThrottleDelay(delay: number): void {
        this.throttleDelay = Math.max(0, delay);
    }

    /**
     * 暂停键盘管理器
     */
    pause(): void {
        this.isActive = false;
        this.resetAllKeyStates();
    }

    /**
     * 恢复键盘管理器
     */
    resume(): void {
        this.isActive = true;
    }

    /**
     * 销毁管理器
     */
    destroy(): void {
        this.resetAllKeyStates();
        this.shortcuts.clear();
    }

    /**
     * 获取所有快捷键列表
     */
    getShortcuts(): Array<{ key: string; description: string }> {
        return Array.from(this.shortcuts.entries()).map(([key, config]) => ({
            key,
            description: config.description
        }));
    }
}

// 创建单例实例
let keyboardManager: KeyboardManager | null = null;

export function getKeyboardManager(): KeyboardManager {
    if (!keyboardManager) {
        keyboardManager = new KeyboardManager();
    }
    return keyboardManager;
}

export function destroyKeyboardManager(): void {
    if (keyboardManager) {
        keyboardManager.destroy();
        keyboardManager = null;
    }
}
