import { EventRegistry } from '../registry.js';
import type { OnEventOptions } from '../types.js';

/**
 * Marks a method as a listener for the given event.
 *
 * The class must be registered and bound to an EventBus via bindEventListeners()
 * or through the framework bootstrap.
 *
 * @example
 * ```ts
 * class NotificationService {
 *   @OnEvent('user.created')
 *   handleUserCreated(payload: { id: string }) {
 *     console.log('new user', payload.id)
 *   }
 *
 *   @OnEvent('order.*', { priority: 'high' })
 *   handleAnyOrder(payload: unknown) { }
 * }
 *
 * // Bootstrap:
 * const svc = new NotificationService()
 * bindEventListeners(svc, bus)
 * ```
 */
export function OnEvent(event: string, options: OnEventOptions = {}) {
  return (
    target: object,
    propertyKey: string | symbol,
    _descriptor: PropertyDescriptor
  ): void => {
    EventRegistry.addListener(target.constructor, {
      event,
      propertyKey,
      options,
    });
  };
}
