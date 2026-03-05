interface ShortcutConfig {
    key: string;
    ctrl?: boolean;
    alt?: boolean;
    shift?: boolean;
    meta?: boolean;
    handler: () => void;
    description: string;
}
export declare class KeyboardManager {
    private keyStates;
    private shortcuts;
    private debounceTimers;
    private throttleTimers;
    private throttleLastExec;
    private debounceDelay;
    private throttleDelay;
    private repeatDelay;
    private repeatInterval;
    private debounceKeys;
    private throttleKeys;
    private isActive;
    constructor();
    private bindGlobalEvents;
    private handleKeyDown;
    private handleKeyUp;
    private updateKeyState;
    private handleDebounce;
    private handleThrottle;
    private handleKeyRepeat;
    private getShortcutKey;
    private executeShortcut;
    private emitKeyEvent;
    private shouldPreventDefault;
    private resetAllKeyStates;
    registerShortcut(config: ShortcutConfig): void;
    unregisterShortcut(key: string): void;
    isKeyPressed(key: string): boolean;
    getKeyPressDuration(key: string): number;
    setDebounceDelay(delay: number): void;
    setThrottleDelay(delay: number): void;
    pause(): void;
    resume(): void;
    destroy(): void;
    getShortcuts(): Array<{
        key: string;
        description: string;
    }>;
}
export declare function getKeyboardManager(): KeyboardManager;
export declare function destroyKeyboardManager(): void;
export {};
//# sourceMappingURL=keyboardManager.d.ts.map