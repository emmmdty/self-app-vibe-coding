export class UndoController<T> {
  private payload: T | null = null;
  private timerId: number | null = null;
  private readonly durationMs: number;
  private readonly onExpire: () => void;

  constructor(durationMs: number, onExpire: () => void) {
    this.durationMs = durationMs;
    this.onExpire = onExpire;
  }

  start(payload: T): void {
    this.dismiss();
    this.payload = payload;
    this.timerId = window.setTimeout(() => {
      this.payload = null;
      this.timerId = null;
      this.onExpire();
    }, this.durationMs);
  }

  consume(): T | null {
    const currentPayload = this.payload;
    this.dismiss();
    return currentPayload;
  }

  dismiss(): void {
    if (this.timerId !== null) {
      window.clearTimeout(this.timerId);
      this.timerId = null;
    }
    this.payload = null;
  }
}
