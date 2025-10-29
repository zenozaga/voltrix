/**
 * 🚀 Ultra-fast Decorator Helper
 * Base helper for creating optimized decorators with WeakMap caching
 */

import { getMetadataStore } from '../stores/metadata.store.js';

export interface DecoratorOptions<T = any> {
  type: string | symbol;
  key: string | symbol;
  targetResolver?: (target: any) => any;
  options: (saved: T, Target: any, propertyKey: string | symbol | undefined, descriptor?: PropertyDescriptor) => T;
}

/**
 * Ultra-optimized decorator helper with WeakMap performance
 */
export function DecoratorHelper<T = any>(config: DecoratorOptions<T>) {
  return function (target: any, propertyKey?: string | symbol, descriptor?: PropertyDescriptor) {
    const metadataStore = getMetadataStore();
    const resolvedTarget = config.targetResolver ? config.targetResolver(target) : target;
    
    // Get existing data from ultra-fast WeakMap store
    const existingData = metadataStore.get(resolvedTarget, config.key) as T;
    
    // Process and store new data
    const newData = config.options(existingData, resolvedTarget, propertyKey, descriptor);
    
    // Store with maximum performance
    metadataStore.set(resolvedTarget, config.key, newData);
    
    return descriptor || target;
  };
}

/**
 * Get decorator data with ultra-fast lookup
 */
export function getDecorData<T>(target: any, key: string | symbol): T | undefined {
  const metadataStore = getMetadataStore();
  return metadataStore.get(target, key) as T;
}