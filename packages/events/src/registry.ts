import type { OnEventMetadata } from './types.js';

/** Reflect metadata key for @OnEvent listeners. */
export const EVENT_LISTENER_META = Symbol.for('voltrix:event:listeners');

/** Reflect metadata key for @EmitEvent emitters. */
export const EVENT_EMITTER_META = Symbol.for('voltrix:event:emitters');

/**
 * Registry for event decorator metadata.
 * Stored directly on class constructors via Reflect.
 */
export const EventRegistry = {
  /** Return all @OnEvent entries registered on a class. */
  getListeners(target: object): OnEventMetadata[] {
    return (
      (Reflect.getMetadata(EVENT_LISTENER_META, target) as OnEventMetadata[] | undefined) ?? []
    );
  },

  /** Append a listener entry to the class's metadata. */
  addListener(target: object, meta: OnEventMetadata): void {
    const existing = EventRegistry.getListeners(target);
    existing.push(meta);
    Reflect.defineMetadata(EVENT_LISTENER_META, existing, target);
  },

  /** Return true if the class has any @OnEvent decorators. */
  hasListeners(target: object): boolean {
    return Reflect.hasMetadata(EVENT_LISTENER_META, target);
  },

  /** Return the event names emitted by a class via @EmitEvent. */
  getEmitters(target: object): string[] {
    return (Reflect.getMetadata(EVENT_EMITTER_META, target) as string[] | undefined) ?? [];
  },

  /** Append an emitter event name to the class's metadata. */
  addEmitter(target: object, event: string): void {
    const existing = EventRegistry.getEmitters(target);
    if (!existing.includes(event)) {
      existing.push(event);
      Reflect.defineMetadata(EVENT_EMITTER_META, existing, target);
    }
  },
};

/**
 * Bind all @OnEvent-decorated methods of an instance to an event bus.
 * Call this after resolving the instance from your DI container.
 *
 * @returns Array of unsubscribe functions.
 */
export function bindEventListeners<T extends object>(
  instance: T,
  bus: {
    on(
      event: string,
      handler: (payload: unknown) => void | Promise<void>,
      opts?: Record<string, unknown>
    ): () => void;
  }
): Array<() => void> {
  const listeners = EventRegistry.getListeners(instance.constructor);
  return listeners.map(({ event, propertyKey, options }) => {
    const handler = (instance as Record<string | symbol, any>)[propertyKey].bind(instance);
    return bus.on(event, handler, options as Record<string, unknown>);
  });
}
