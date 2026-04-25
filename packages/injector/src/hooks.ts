import type { HookEvent } from '.\/providers.js';

export type Hook = (ev: HookEvent) => void;

export class Hooks {
  private listeners: Hook[] = [];

  get hasListeners(): boolean {
    return this.listeners.length !== 0;
  }

  on(listener: Hook): () => void {
    this.listeners.push(listener);

    let active = true;

    return () => {
      if (!active) return;
      active = false;

      const index = this.listeners.indexOf(listener);
      if (index === -1) return;

      const lastIndex = this.listeners.length - 1;
      if (index !== lastIndex) {
        this.listeners[index] = this.listeners[lastIndex];
      }
      this.listeners.pop();
    };
  }

  emit(event: HookEvent): void {
    const listeners = this.listeners;

    for (let i = 0; i < listeners.length; i++) {
      try {
        listeners[i](event);
      } catch {
        // Ignore listener errors to avoid breaking the emitter flow.
      }
    }
  }

  clear(): void {
    this.listeners = [];
  }

  count(): number {
    return this.listeners.length;
  }
}
