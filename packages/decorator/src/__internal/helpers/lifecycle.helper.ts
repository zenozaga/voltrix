/**
 * Ultra-fast lifecycle management system
 * Optimized for high-performance hook execution
 */

import { getMetadata, setMetadata } from '../stores/metadata.store.js';
import { 
  KEY_LIFECYCLE_HOOKS, 
  KEY_ON_INIT, 
  KEY_ON_DESTROY, 
  KEY_ON_REQUEST, 
  KEY_ON_RESPONSE, 
  KEY_ON_ERROR 
} from '../symbols.constant.js';

export type LifecycleHook = 'onInit' | 'onDestroy' | 'onRequest' | 'onResponse' | 'onError';

export interface HookDescriptor {
  readonly handler: Function;
  readonly priority: number;
  readonly name?: string;
  readonly async?: boolean;
}

/**
 * High-performance lifecycle manager
 */
export class LifecycleManager {
  private static readonly instances = new WeakMap<Function, LifecycleManager>();
  
  private readonly hooks = new Map<LifecycleHook, HookDescriptor[]>();

  /**
   * Get or create manager instance for target
   */
  static getInstance(target: Function): LifecycleManager {
    let manager = this.instances.get(target);
    if (!manager) {
      manager = new LifecycleManager();
      this.instances.set(target, manager);
      setMetadata(KEY_LIFECYCLE_HOOKS, manager, target);
    }
    return manager;
  }

  /**
   * Add lifecycle hook
   */
  addHook(
    type: LifecycleHook, 
    handler: Function, 
    priority = 0, 
    name?: string, 
    async = false
  ): this {
    let hooks = this.hooks.get(type);
    if (!hooks) {
      hooks = [];
      this.hooks.set(type, hooks);
    }
    
    hooks.push({ handler, priority, name, async });
    hooks.sort((a, b) => b.priority - a.priority);
    
    return this;
  }

  /**
   * Execute lifecycle hooks
   */
  async executeHooks(type: LifecycleHook, context: any): Promise<void> {
    const hooks = this.hooks.get(type);
    if (!hooks || hooks.length === 0) return;

    const syncHooks: Function[] = [];
    const asyncHooks: Function[] = [];

    // Separate sync and async hooks for optimal execution
    for (const hook of hooks) {
      if (hook.async) {
        asyncHooks.push(hook.handler);
      } else {
        syncHooks.push(hook.handler);
      }
    }

    // Execute sync hooks first (faster)
    for (const handler of syncHooks) {
      try {
        handler(context);
      } catch (error) {
        console.error(`Sync lifecycle hook error [${type}]:`, error);
      }
    }

    // Execute async hooks in parallel for better performance
    if (asyncHooks.length > 0) {
      await Promise.allSettled(
        asyncHooks.map(handler => 
          Promise.resolve(handler(context)).catch(error => 
            console.error(`Async lifecycle hook error [${type}]:`, error)
          )
        )
      );
    }
  }

  /**
   * Execute hooks synchronously (for performance-critical paths)
   */
  executeSyncHooks(type: LifecycleHook, context: any): void {
    const hooks = this.hooks.get(type);
    if (!hooks || hooks.length === 0) return;

    for (const hook of hooks) {
      if (!hook.async) {
        try {
          hook.handler(context);
        } catch (error) {
          console.error(`Lifecycle hook error [${type}]:`, error);
        }
      }
    }
  }

  /**
   * Remove hook by name
   */
  removeHook(type: LifecycleHook, name: string): boolean {
    const hooks = this.hooks.get(type);
    if (!hooks) return false;

    const index = hooks.findIndex(h => h.name === name);
    if (index !== -1) {
      hooks.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Clear all hooks for a type
   */
  clearHooks(type: LifecycleHook): void {
    this.hooks.delete(type);
  }

  /**
   * Clear all hooks
   */
  clearAllHooks(): void {
    this.hooks.clear();
  }

  /**
   * Get hooks count for a type
   */
  getHooksCount(type: LifecycleHook): number {
    return this.hooks.get(type)?.length ?? 0;
  }

  /**
   * Check if has hooks for a type
   */
  hasHooks(type: LifecycleHook): boolean {
    const hooks = this.hooks.get(type);
    return hooks !== undefined && hooks.length > 0;
  }
}

/**
 * Fast lifecycle hook creators
 */
export function onInit(handler: Function, priority = 0, name?: string, async = false) {
  return function(target: any) {
    const manager = LifecycleManager.getInstance(target);
    manager.addHook('onInit', handler, priority, name, async);
    return target;
  };
}

export function onDestroy(handler: Function, priority = 0, name?: string, async = false) {
  return function(target: any) {
    const manager = LifecycleManager.getInstance(target);
    manager.addHook('onDestroy', handler, priority, name, async);
    return target;
  };
}

export function onRequest(handler: Function, priority = 0, name?: string, async = false) {
  return function(target: any, propertyKey?: string | symbol, descriptor?: PropertyDescriptor) {
    const targetFunc = descriptor?.value ?? target;
    const manager = LifecycleManager.getInstance(targetFunc);
    manager.addHook('onRequest', handler, priority, name, async);
    return descriptor ?? target;
  };
}

export function onResponse(handler: Function, priority = 0, name?: string, async = false) {
  return function(target: any, propertyKey?: string | symbol, descriptor?: PropertyDescriptor) {
    const targetFunc = descriptor?.value ?? target;
    const manager = LifecycleManager.getInstance(targetFunc);
    manager.addHook('onResponse', handler, priority, name, async);
    return descriptor ?? target;
  };
}

export function onError(handler: Function, priority = 0, name?: string, async = false) {
  return function(target: any, propertyKey?: string | symbol, descriptor?: PropertyDescriptor) {
    const targetFunc = descriptor?.value ?? target;
    const manager = LifecycleManager.getInstance(targetFunc);
    manager.addHook('onError', handler, priority, name, async);
    return descriptor ?? target;
  };
}