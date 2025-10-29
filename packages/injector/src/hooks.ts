import type { HookEvent } from './providers';

export type Hook = (ev: HookEvent) => void;

export class Hooks {
  private listeners: Hook[] = [];

  on(h: Hook): () => void {
    this.listeners.push(h);
    return () => {
      const idx = this.listeners.indexOf(h);
      if (idx >= 0) this.listeners.splice(idx, 1);
    };
  }

  emit(ev: HookEvent): void {
    const arr = this.listeners;
    for (let i = 0; i < arr.length; i++) {
      try {
        arr[i]?.(ev);
      } catch {}
    }
  }

  clear(): void {
    this.listeners.length = 0;
  }

  count(): number {
    return this.listeners.length;
  }
}
