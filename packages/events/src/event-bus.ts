import { MaxListenersExceededWarning } from './errors.js';
import type {
  BatchEmitEntry,
  EventBusOptions,
  EventHandler,
  EventMap,
  EventMiddlewareFn,
  HandlerPriority,
  IEventTransport,
  ListenerOptions,
  Unsubscribe,
} from './types.js';

// ─── Internals ────────────────────────────────────────────────────────────────

const PRIORITY_ORDER: Record<HandlerPriority, number> = { high: 0, normal: 1, low: 2 };

interface InternalEntry {
  handler: EventHandler;
  priority: HandlerPriority;
  once: boolean;
  /** Set when this entry was collected via a wildcard pattern match. */
  wildcardPattern?: string;
}

interface WildcardEntry {
  pattern: string;
  matcher: (event: string) => boolean;
  entries: InternalEntry[];
}

// ─── Pattern Compiler ─────────────────────────────────────────────────────────

/**
 * Compiles a wildcard pattern into a fast matcher.
 * Supports:
 *   *  — matches exactly one segment  (user.*)
 *   ** — matches zero or more segments (**.failed)
 *
 * The result is stored once per pattern in WildcardEntry — no re-compilation.
 */
function compilePattern(pattern: string, delimiter: string): (event: string) => boolean {
  // Fast path: no wildcards
  if (!pattern.includes('*')) return (e) => e === pattern;

  const parts = pattern.split(delimiter);
  const hasDeepWild = parts.includes('**');

  if (!hasDeepWild) {
    // Only single-segment wildcards — O(segments) per match
    return (event: string) => {
      const eParts = event.split(delimiter);
      if (eParts.length !== parts.length) return false;
      for (let i = 0; i < parts.length; i++) {
        if (parts[i] !== '*' && parts[i] !== eParts[i]) return false;
      }
      return true;
    };
  }

  // Deep wildcard — recursive segment matching
  return (event: string) => matchDeep(parts, event.split(delimiter));
}

function matchDeep(pattern: string[], event: string[]): boolean {
  let pi = 0;
  let ei = 0;

  while (pi < pattern.length && ei < event.length) {
    if (pattern[pi] === '**') {
      if (pi === pattern.length - 1) return true; // ** at end — matches rest
      for (let ni = ei; ni <= event.length; ni++) {
        if (matchDeep(pattern.slice(pi + 1), event.slice(ni))) return true;
      }
      return false;
    }
    if (pattern[pi] !== '*' && pattern[pi] !== event[ei]) return false;
    pi++;
    ei++;
  }

  // Consume trailing **
  while (pi < pattern.length && pattern[pi] === '**') pi++;
  return pi === pattern.length && ei === event.length;
}

// ─── EventBus ─────────────────────────────────────────────────────────────────

/**
 * Typed event bus with priority, wildcards, middleware, and optional transport.
 *
 * @example
 * ```ts
 * interface AppEvents {
 *   'user.created': { id: string; email: string }
 *   'order.completed': { orderId: string }
 * }
 *
 * const bus = new EventBus<AppEvents>()
 *
 * bus.on('user.created', ({ id }) => console.log(id))
 * bus.on('user.*', (payload) => console.log('any user event', payload))
 *
 * await bus.emit('user.created', { id: '1', email: 'a@b.com' })
 * ```
 */
export class EventBus<TMap extends EventMap = EventMap> {
  // Exact-event handlers: event → sorted InternalEntry[]
  private readonly _exact = new Map<string, InternalEntry[]>();
  // Wildcard handlers: compiled pattern matchers
  private readonly _wildcards: WildcardEntry[] = [];
  // Middleware pipeline
  private readonly _middleware: EventMiddlewareFn[] = [];
  // Optional external transport (Redis, RabbitMQ, etc.)
  private _transport?: IEventTransport<TMap>;

  private readonly _maxListeners: number;
  private readonly _delimiter: string;

  constructor(options?: EventBusOptions<TMap>) {
    this._maxListeners = options?.maxListeners ?? 100;
    this._delimiter = options?.delimiter ?? '.';
    this._transport = options?.transport;
  }

  // ─── Emit ──────────────────────────────────────────────────────────────────

  async emit<K extends keyof TMap & string>(event: K, payload: TMap[K]): Promise<void> {
    if (this._middleware.length) {
      await this._runMiddleware(event, payload, () => this._dispatch(event, payload));
    } else {
      await this._dispatch(event, payload);
    }
  }

  // ─── Subscribe ─────────────────────────────────────────────────────────────

  on<K extends keyof TMap & string>(
    event: K,
    handler: EventHandler<TMap[K]>,
    opts?: ListenerOptions
  ): Unsubscribe;
  on(pattern: string, handler: EventHandler, opts?: ListenerOptions): Unsubscribe;
  on(eventOrPattern: string, handler: EventHandler, opts: ListenerOptions = {}): Unsubscribe {
    const priority = opts.priority ?? 'normal';
    const once = opts.once ?? false;

    if (this._isWildcard(eventOrPattern)) {
      return this._addWildcard(eventOrPattern, handler, priority, once);
    }
    return this._addExact(eventOrPattern, handler, priority, once);
  }

  once<K extends keyof TMap & string>(
    event: K,
    handler: EventHandler<TMap[K]>
  ): Unsubscribe {
    return this.on(event, handler, { once: true });
  }

  off<K extends keyof TMap & string>(event: K, handler: EventHandler<TMap[K]>): void;
  off(pattern: string, handler: EventHandler): void;
  off(eventOrPattern: string, handler: EventHandler): void {
    if (this._isWildcard(eventOrPattern)) {
      this._removeWildcard(eventOrPattern, handler);
    } else {
      this._removeExact(eventOrPattern, handler);
    }
  }

  // ─── Middleware ─────────────────────────────────────────────────────────────

  /**
   * Add a middleware to the event pipeline.
   * Middlewares run in insertion order before handlers are called.
   *
   * @example
   * bus.use(async (event, payload, next) => {
   *   console.log(`[event] ${event}`)
   *   await next()
   * })
   */
  use(fn: EventMiddlewareFn): this {
    this._middleware.push(fn);
    return this;
  }

  // ─── Transport ─────────────────────────────────────────────────────────────

  /** Replace the external transport at runtime. */
  setTransport(transport: IEventTransport<TMap>): void {
    this._transport = transport;
  }

  getTransport(): IEventTransport<TMap> | undefined {
    return this._transport;
  }

  // ─── Batch ─────────────────────────────────────────────────────────────────

  /** Emit multiple events concurrently. */
  async emitBatch<K extends keyof TMap & string>(
    events: BatchEmitEntry<TMap, K>[]
  ): Promise<void> {
    await Promise.all(events.map(({ event, payload }) => this.emit(event, payload)));
  }

  // ─── Introspection ─────────────────────────────────────────────────────────

  listenerCount(event: string): number {
    return this._exact.get(event)?.length ?? 0;
  }

  wildcardCount(): number {
    return this._wildcards.reduce((acc, w) => acc + w.entries.length, 0);
  }

  eventNames(): Array<keyof TMap & string> {
    return Array.from(this._exact.keys()) as Array<keyof TMap & string>;
  }

  hasListeners(event: string): boolean {
    if (this._exact.get(event)?.length) return true;
    return this._wildcards.some((w) => w.matcher(event) && w.entries.length > 0);
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  /** Remove all listeners for a specific event, or all events if omitted. */
  clear(event?: string): void {
    if (event !== undefined) {
      this._exact.delete(event);
      const idx = this._wildcards.findIndex((w) => w.pattern === event);
      if (idx !== -1) this._wildcards.splice(idx, 1);
    } else {
      this._exact.clear();
      this._wildcards.length = 0;
    }
  }

  /** Clear all state and disconnect transport. */
  dispose(): void {
    this.clear();
    this._middleware.length = 0;
    this._transport?.clear?.();
    this._transport = undefined;
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  private async _dispatch(event: string, payload: unknown): Promise<void> {
    // Snapshot exact entries before iteration (handlers may mutate the list)
    const exactEntries = this._exact.get(event) ? [...this._exact.get(event)!] : [];

    // Collect matching wildcard entries, annotated with their source pattern
    const wildcardEntries = this._getMatchingWildcards(event);

    // Merge; sort only when mixing priorities
    const allLocal: InternalEntry[] = exactEntries.concat(wildcardEntries);
    if (allLocal.length > 1) {
      allLocal.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
    }

    const results: Promise<void>[] = [];

    for (const entry of allLocal) {
      try {
        const r = entry.handler(payload);
        if (r instanceof Promise) results.push(r);
      } catch (err) {
        results.push(Promise.reject(err as Error));
      }
    }

    // Remove once-handlers (after invocation, not before — avoids re-entrant issues)
    for (const entry of allLocal) {
      if (entry.once) {
        if (entry.wildcardPattern !== undefined) {
          this._removeWildcard(entry.wildcardPattern, entry.handler);
        } else {
          this._removeExact(event, entry.handler);
        }
      }
    }

    // Forward to external transport after local dispatch
    if (this._transport) {
      results.push(this._transport.publish(event as keyof TMap & string, payload as any));
    }

    if (results.length) await Promise.all(results);
  }

  private async _runMiddleware(
    event: string,
    payload: unknown,
    final: () => Promise<void>
  ): Promise<void> {
    let index = 0;
    const next = async (): Promise<void> => {
      if (index >= this._middleware.length) return final();
      await this._middleware[index++](event, payload, next);
    };
    await next();
  }

  private _isWildcard(pattern: string): boolean {
    return pattern.includes('*');
  }

  private _addExact(
    event: string,
    handler: EventHandler,
    priority: HandlerPriority,
    once: boolean
  ): Unsubscribe {
    let list = this._exact.get(event);
    if (!list) {
      list = [];
      this._exact.set(event, list);
    }

    if (list.length >= this._maxListeners) {
      console.warn(
        new MaxListenersExceededWarning(event, list.length + 1, this._maxListeners).message
      );
    }

    list.push({ handler, priority, once });
    if (list.length > 1) {
      list.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
    }

    return () => this._removeExact(event, handler);
  }

  private _removeExact(event: string, handler: EventHandler): void {
    const list = this._exact.get(event);
    if (!list) return;
    const idx = list.findIndex((e) => e.handler === handler);
    if (idx !== -1) {
      list.splice(idx, 1);
      if (!list.length) this._exact.delete(event);
    }
  }

  private _addWildcard(
    pattern: string,
    handler: EventHandler,
    priority: HandlerPriority,
    once: boolean
  ): Unsubscribe {
    let entry = this._wildcards.find((w) => w.pattern === pattern);
    if (!entry) {
      entry = {
        pattern,
        matcher: compilePattern(pattern, this._delimiter),
        entries: [],
      };
      this._wildcards.push(entry);
    }

    entry.entries.push({ handler, priority, once });
    if (entry.entries.length > 1) {
      entry.entries.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
    }

    return () => this._removeWildcard(pattern, handler);
  }

  private _removeWildcard(pattern: string, handler: EventHandler): void {
    const wEntry = this._wildcards.find((w) => w.pattern === pattern);
    if (!wEntry) return;
    const idx = wEntry.entries.findIndex((e) => e.handler === handler);
    if (idx !== -1) {
      wEntry.entries.splice(idx, 1);
      if (!wEntry.entries.length) {
        const wIdx = this._wildcards.indexOf(wEntry);
        if (wIdx !== -1) this._wildcards.splice(wIdx, 1);
      }
    }
  }

  private _getMatchingWildcards(event: string): InternalEntry[] {
    if (!this._wildcards.length) return [];
    const result: InternalEntry[] = [];
    for (const w of this._wildcards) {
      if (w.matcher(event)) {
        // Annotate with source pattern so once-removal works correctly
        for (const entry of w.entries) {
          result.push({ ...entry, wildcardPattern: w.pattern });
        }
      }
    }
    return result;
  }
}
