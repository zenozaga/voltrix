// ─── Event Map ────────────────────────────────────────────────────────────────

/** User-defined map of event names to their payload types. */
export type EventMap = Record<string, any>;

// ─── Handler Types ────────────────────────────────────────────────────────────

/** Function called when an event is emitted. */
export type EventHandler<T = any> = (payload: T) => void | Promise<void>;

/**
 * Middleware function in the event pipeline.
 * Call next() to continue to the next middleware or the actual dispatch.
 */
export type EventMiddlewareFn = (
  event: string,
  payload: unknown,
  next: () => Promise<void>
) => void | Promise<void>;

/** Function returned by on() / once() to remove the listener. */
export type Unsubscribe = () => void;

// ─── Options ──────────────────────────────────────────────────────────────────

/**
 * Execution priority for a handler.
 * high → normal → low within the same event.
 */
export type HandlerPriority = 'high' | 'normal' | 'low';

/** Options passed to on() / once(). */
export interface ListenerOptions {
  /** Remove the handler after first invocation. */
  once?: boolean;
  /** Execution order relative to other handlers for the same event. */
  priority?: HandlerPriority;
}

/** Options for the @OnEvent decorator. */
export interface OnEventOptions {
  priority?: HandlerPriority;
}

/** Options for the @EmitEvent decorator. */
export interface EmitEventOptions {
  /**
   * Transform the method return value before emitting.
   * Useful when the payload should differ from the raw return value.
   */
  transform?: (result: unknown) => unknown;
}

// ─── Transport ────────────────────────────────────────────────────────────────

/**
 * Transport abstraction. Implement this to add Redis, RabbitMQ, Kafka, etc.
 *
 * The EventBus calls publish() after running all local handlers so events
 * can be forwarded to external subscribers.
 *
 * subscribe/unsubscribe/connect/disconnect are optional hooks for transports
 * that need to set up listeners for INCOMING events from external sources.
 */
export interface IEventTransport<TMap extends EventMap = EventMap> {
  publish<K extends keyof TMap & string>(event: K, payload: TMap[K]): Promise<void>;
  subscribe?<K extends keyof TMap & string>(event: K, handler: EventHandler<TMap[K]>): void;
  unsubscribe?<K extends keyof TMap & string>(event: K, handler: EventHandler<TMap[K]>): void;
  connect?(): Promise<void>;
  disconnect?(): Promise<void>;
  clear?(): void;
}

// ─── EventBus Options ─────────────────────────────────────────────────────────

/** Options passed to the EventBus constructor. */
export interface EventBusOptions<TMap extends EventMap = EventMap> {
  /**
   * External transport for cross-process / cross-machine event delivery.
   * When set, emit() forwards events to the transport after local dispatch.
   */
  transport?: IEventTransport<TMap>;
  /**
   * Warn when a single event accumulates more than this many listeners.
   * @default 100
   */
  maxListeners?: number;
  /**
   * Segment delimiter used for wildcard pattern matching.
   * @default '.'
   */
  delimiter?: string;
}

// ─── Batch ────────────────────────────────────────────────────────────────────

/** Entry for emitBatch(). */
export interface BatchEmitEntry<
  TMap extends EventMap,
  K extends keyof TMap & string = keyof TMap & string,
> {
  event: K;
  payload: TMap[K];
}

// ─── Decorator Metadata ───────────────────────────────────────────────────────

/** Stored per decorated method by @OnEvent. */
export interface OnEventMetadata {
  event: string;
  propertyKey: string | symbol;
  options: OnEventOptions;
}
