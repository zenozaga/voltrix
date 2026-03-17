import { EventRegistry } from '../registry.js';
import type { EmitEventOptions } from '../types.js';

type AnyEventBus = {
  emit(event: string, payload: unknown): Promise<void>;
};

/**
 * Intercepts the decorated method's return value and emits it as an event.
 *
 * The class instance must expose an `eventBus` property (injected via DI
 * or set manually) for the decorator to forward the event.
 *
 * @example
 * ```ts
 * class UserService {
 *   constructor(public eventBus: EventBus<AppEvents>) {}
 *
 *   @EmitEvent('user.created')
 *   async createUser(dto: CreateUserDto) {
 *     return { id: generateId(), ...dto }
 *     // return value is automatically emitted as 'user.created' payload
 *   }
 * }
 * ```
 */
export function EmitEvent(event: string, options: EmitEventOptions = {}) {
  return (
    _target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor => {
    const original = descriptor.value as (...args: unknown[]) => unknown;

    descriptor.value = async function (this: Record<string | symbol, any>, ...args: unknown[]) {
      const result = await original.apply(this, args);
      const payload = options.transform ? options.transform(result) : result;

      const bus: AnyEventBus | undefined = this.eventBus ?? this._eventBus;
      if (bus) {
        await bus.emit(event, payload);
      }

      // Track emitter metadata on the class
      EventRegistry.addEmitter(this.constructor, event);

      return result;
    };

    return descriptor;
  };
}
