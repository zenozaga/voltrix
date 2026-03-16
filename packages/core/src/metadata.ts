import 'reflect-metadata';

/**
 * 🏷️ Global Symbols for Cross-Package Consistency
 */
const METADATA_STORE = Symbol.for('voltrix:metadata_store');
const DISCOVERY_INDEX = Symbol.for('voltrix:discovery_index');

// Global Stores ensure that even different copies of @voltrix/core share the same data in a monorepo
const globalStore: WeakMap<object, Map<string | symbol, Record<string, any>>> = 
  (globalThis as any)[METADATA_STORE] || ((globalThis as any)[METADATA_STORE] = new WeakMap());

const globalIndex: Set<any> = 
  (globalThis as any)[DISCOVERY_INDEX] || ((globalThis as any)[DISCOVERY_INDEX] = new Set());

/**
 * 🛠️ Unified Metadata Utility
 * Optimized for hierarchical, prefixed metadata storage.
 * Uses a global registry to ensure consistency across multiple package instances.
 */
export class Metadata {
  /**
   * Get metadata for a target. Auto-initializes if missing.
   */
  static get(target: object, propertyKey?: string | symbol): Record<string, any> {
    const key = propertyKey || '@@class';
    
    let targetMap = globalStore.get(target);
    if (!targetMap) {
      targetMap = new Map();
      globalStore.set(target, targetMap);
    }

    let meta = targetMap.get(key);
    if (!meta) {
      meta = {};
      targetMap.set(key, meta);
      
      // Auto-track annotated classes in the global discovery index
      if (!propertyKey && typeof target === 'function') {
        Metadata.track(target as any);
      }
    }

    return meta;
  }

  /**
   * Set root-level metadata on a target (Replaces whole object)
   */
  static rawSet(target: object, propertyKey: string | symbol | undefined, value: any): void {
    const key = propertyKey || '@@class';
    let targetMap = globalStore.get(target);
    if (!targetMap) {
      targetMap = new Map();
      globalStore.set(target, targetMap);
    }
    targetMap.set(key, value);
  }

  /**
   * Create a prefixed metadata accessor
   */
  static prefix(name: string) {
    return {
      set: (target: object, propertyKey: string | symbol | undefined, data: any) => {
        const root = Metadata.get(target, propertyKey);
        root[name] = { ...(root[name] || {}), ...data };
      },
      get: (target: object, propertyKey?: string | symbol): any => {
        const root = Metadata.get(target, propertyKey);
        if (!root[name]) root[name] = {};
        return root[name];
      }
    };
  }

  /**
   * Track a class in the global discovery index
   */
  private static track(ctor: any): void {
    if (typeof ctor === 'function') {
      globalIndex.add(ctor);
    }
  }

  /**
   * Get all tracked classes
   */
  static getTrackedClasses(): any[] {
    return Array.from(globalIndex);
  }
}
