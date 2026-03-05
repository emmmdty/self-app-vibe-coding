export class KeyboardManager {
    constructor() {
        this.keyStates = new Map();
        this.shortcuts = new Map();
        this.debounceTimers = new Map();
        this.throttleTimers = new Map();
        this.throttleLastExec = new Map();
        this.debounceDelay = 150;
        this.throttleDelay = 100;
        this.repeatDelay = 500;
        this.repeatInterval = 50;
        this.debounceKeys = new Set(['Enter', ' ', 'Escape']);
        this.throttleKeys = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
        this.isActive = true;
        this.bindGlobalEvents();
    }
    bindGlobalEvents() {
        document.addEventListener('keydown', this.handleKeyDown.bind(this), true);
        document.addEventListener('keyup', this.handleKeyUp.bind(this), true);
        document.addEventListener('keydown', (e) => {
            if (this.shouldPreventDefault(e)) {
                e.preventDefault();
            }
        }, true);
        window.addEventListener('blur', () => {
            this.resetAllKeyStates();
        });
        document.addEventListener('visibilitychange', () => {
            this.isActive = document.visibilityState === 'visible';
            if (!this.isActive) {
                this.resetAllKeyStates();
            }
        });
    }
    handleKeyDown(e) {
        if (!this.isActive)
            return;
        const key = e.key;
        const now = Date.now();
        this.updateKeyState(key, true, now);
        const shortcutKey = this.getShortcutKey(e);
        if (this.shortcuts.has(shortcutKey)) {
            e.preventDefault();
            e.stopPropagation();
            this.executeShortcut(shortcutKey);
            return;
        }
        if (this.debounceKeys.has(key)) {
            this.handleDebounce(key, () => this.emitKeyEvent('keydown', e));
            return;
        }
        if (this.throttleKeys.has(key)) {
            this.handleThrottle(key, () => this.emitKeyEvent('keydown', e));
            return;
        }
        this.emitKeyEvent('keydown', e);
        this.handleKeyRepeat(key, e);
    }
    handleKeyUp(e) {
        const key = e.key;
        this.updateKeyState(key, false, Date.now());
        if (this.debounceTimers.has(key)) {
            clearTimeout(this.debounceTimers.get(key));
            this.debounceTimers.delete(key);
        }
        this.emitKeyEvent('keyup', e);
    }
    updateKeyState(key, isPressed, timestamp) {
        const state = this.keyStates.get(key);
        if (isPressed) {
            if (!state || !state.isPressed) {
                this.keyStates.set(key, {
                    isPressed: true,
                    pressedAt: timestamp,
                    lastRepeatAt: timestamp
                });
            }
        }
        else {
            if (state) {
                state.isPressed = false;
            }
        }
    }
    handleDebounce(key, callback) {
        if (this.debounceTimers.has(key)) {
            clearTimeout(this.debounceTimers.get(key));
        }
        const timer = window.setTimeout(() => {
            callback();
            this.debounceTimers.delete(key);
        }, this.debounceDelay);
        this.debounceTimers.set(key, timer);
    }
    handleThrottle(key, callback) {
        const now = Date.now();
        const lastExec = this.throttleLastExec.get(key) || 0;
        if (now - lastExec >= this.throttleDelay) {
            this.throttleLastExec.set(key, now);
            callback();
            return;
        }
        if (!this.throttleTimers.has(key)) {
            const timer = window.setTimeout(() => {
                this.throttleLastExec.set(key, Date.now());
                callback();
                this.throttleTimers.delete(key);
            }, this.throttleDelay - (now - lastExec));
            this.throttleTimers.set(key, timer);
        }
    }
    handleKeyRepeat(key, e) {
        const state = this.keyStates.get(key);
        if (!state)
            return;
        let repeatFrame;
        const checkRepeat = () => {
            const currentState = this.keyStates.get(key);
            if (!currentState || !currentState.isPressed) {
                cancelAnimationFrame(repeatFrame);
                return;
            }
            const now = Date.now();
            const pressedDuration = now - currentState.pressedAt;
            const timeSinceLastRepeat = now - currentState.lastRepeatAt;
            if (pressedDuration > this.repeatDelay && timeSinceLastRepeat > this.repeatInterval) {
                currentState.lastRepeatAt = now;
                this.emitKeyEvent('keyrepeat', e);
            }
            repeatFrame = requestAnimationFrame(checkRepeat);
        };
        repeatFrame = requestAnimationFrame(checkRepeat);
    }
    getShortcutKey(e) {
        const parts = [];
        if (e.ctrlKey)
            parts.push('Ctrl');
        if (e.altKey)
            parts.push('Alt');
        if (e.shiftKey)
            parts.push('Shift');
        if (e.metaKey)
            parts.push('Meta');
        parts.push(e.key);
        return parts.join('+');
    }
    executeShortcut(shortcutKey) {
        const shortcut = this.shortcuts.get(shortcutKey);
        if (shortcut) {
            if ('requestIdleCallback' in window) {
                requestIdleCallback(() => shortcut.handler(), { timeout: 100 });
            }
            else {
                setTimeout(shortcut.handler, 0);
            }
        }
    }
    emitKeyEvent(type, e) {
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
    shouldPreventDefault(e) {
        if (e.ctrlKey || e.metaKey) {
            const blockedKeys = ['s', 'p', 'f', 'h'];
            if (blockedKeys.includes(e.key.toLowerCase())) {
                return true;
            }
        }
        return false;
    }
    resetAllKeyStates() {
        this.keyStates.clear();
        this.debounceTimers.forEach(timer => clearTimeout(timer));
        this.debounceTimers.clear();
        this.throttleTimers.forEach(timer => clearTimeout(timer));
        this.throttleTimers.clear();
    }
    registerShortcut(config) {
        const key = [
            config.ctrl ? 'Ctrl' : '',
            config.alt ? 'Alt' : '',
            config.shift ? 'Shift' : '',
            config.meta ? 'Meta' : '',
            config.key
        ].filter(Boolean).join('+');
        this.shortcuts.set(key, config);
    }
    unregisterShortcut(key) {
        this.shortcuts.delete(key);
    }
    isKeyPressed(key) {
        const state = this.keyStates.get(key);
        return state ? state.isPressed : false;
    }
    getKeyPressDuration(key) {
        const state = this.keyStates.get(key);
        if (state && state.isPressed) {
            return Date.now() - state.pressedAt;
        }
        return 0;
    }
    setDebounceDelay(delay) {
        this.debounceDelay = Math.max(0, delay);
    }
    setThrottleDelay(delay) {
        this.throttleDelay = Math.max(0, delay);
    }
    pause() {
        this.isActive = false;
        this.resetAllKeyStates();
    }
    resume() {
        this.isActive = true;
    }
    destroy() {
        this.resetAllKeyStates();
        this.shortcuts.clear();
    }
    getShortcuts() {
        return Array.from(this.shortcuts.entries()).map(([key, config]) => ({
            key,
            description: config.description
        }));
    }
}
let keyboardManager = null;
export function getKeyboardManager() {
    if (!keyboardManager) {
        keyboardManager = new KeyboardManager();
    }
    return keyboardManager;
}
export function destroyKeyboardManager() {
    if (keyboardManager) {
        keyboardManager.destroy();
        keyboardManager = null;
    }
}
//# sourceMappingURL=keyboardManager.js.map