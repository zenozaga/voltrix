import { EventEmitter } from 'node:events';

export class TypedEventEmitter<TEvents extends object> {
  private readonly _emitter = new EventEmitter();

  on<K extends keyof TEvents>(event: K, listener: TEvents[K]): this {
    this._emitter.on(event as string, listener as unknown as (...args: unknown[]) => void);
    return this;
  }

  once<K extends keyof TEvents>(event: K, listener: TEvents[K]): this {
    this._emitter.once(event as string, listener as unknown as (...args: unknown[]) => void);
    return this;
  }

  off<K extends keyof TEvents>(event: K, listener: TEvents[K]): this {
    this._emitter.off(event as string, listener as unknown as (...args: unknown[]) => void);
    return this;
  }

  emit<K extends keyof TEvents>(event: K, ...args: TEvents[K] extends (...args: infer P) => unknown ? P : never): boolean {
    return this._emitter.emit(event as string, ...args);
  }

  removeAllListeners<K extends keyof TEvents>(event?: K): this {
    this._emitter.removeAllListeners(event as string | undefined);
    return this;
  }
}
