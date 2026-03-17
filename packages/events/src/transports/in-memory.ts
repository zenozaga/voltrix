import type { EventHandler, EventMap, IEventTransport } from '../types.js';

/**
 * Shared in-memory transport.
 *
 * Useful for wiring two EventBus instances together inside the same process,
 * or as a controlled transport in tests.
 *
 * For standard single-bus usage no transport is needed — EventBus handles
 * local dispatch entirely on its own.
 */
export class InMemoryTransport<TMap extends EventMap = EventMap>
  implements IEventTransport<TMap>
{
  private readonly _handlers = new Map<string, Set<EventHandler>>();

  publish<K extends keyof TMap & string>(event: K, payload: TMap[K]): Promise<void> {
    const handlers = this._handlers.get(event);
    if (!handlers?.size) return Promise.resolve();

    const results: Promise<void>[] = [];
    for (const handler of handlers) {
      try {
        const r = handler(payload);
        if (r instanceof Promise) results.push(r);
      } catch (err) {
        results.push(Promise.reject(err as Error));
      }
    }

    return results.length ? Promise.all(results).then(() => void 0) : Promise.resolve();
  }

  subscribe<K extends keyof TMap & string>(event: K, handler: EventHandler<TMap[K]>): void {
    let set = this._handlers.get(event);
    if (!set) {
      set = new Set();
      this._handlers.set(event, set);
    }
    set.add(handler as EventHandler);
  }

  unsubscribe<K extends keyof TMap & string>(event: K, handler: EventHandler<TMap[K]>): void {
    this._handlers.get(event)?.delete(handler as EventHandler);
  }

  clear(): void {
    this._handlers.clear();
  }

  listenerCount(event: string): number {
    return this._handlers.get(event)?.size ?? 0;
  }
}
