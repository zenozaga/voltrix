/**
 * 🚀 Voltrix Metadata Registry
 * Ultra-fast centralized storage using WeakMaps for O(1) access.
 * Eliminates Reflect-metadata overhead in the hotpath.
 */

export type Constructor<T = any> = new (...args: any[]) => T;

export interface MetadataBag {
  target: Constructor;
  type?: string;
  options?: any;
  routes: Map<string | symbol, any>;
  parameters: Map<string | symbol, any[]>;
  middlewares: Map<string | symbol, any[]>;
  custom: Map<string | symbol, any>;
}

/**
 * Global Registry using WeakMap to prevent memory leaks
 */
const registry = new WeakMap<Constructor, MetadataBag>();

/**
 * Discovery Index tracking all annotated classes (for tree construction)
 */
const annotatedClasses = new Set<Constructor>();

/**
 * High-performance Discovery Registry
 */
export const MetadataRegistry = {
  /**
   * Get or create a metadata bag for a constructor
   */
  getOrCreate(target: Constructor): MetadataBag {
    let bag = registry.get(target);
    if (!bag) {
      bag = {
        target,
        routes: new Map(),
        parameters: new Map(),
        middlewares: new Map(),
        custom: new Map()
      };
      registry.set(target, bag);
      annotatedClasses.add(target);
    }
    return bag;
  },

  /**
   * Get all annotated classes in the system
   */
  getClasses(): Constructor[] {
    return Array.from(annotatedClasses);
  },

  /**
   * Get metadata bag for a constructor (readonly)
   */
  get(target: Constructor): MetadataBag | undefined {
    return registry.get(target);
  },

  /**
   * Global Transformer Hook
   */
  _transformer: (ctx: { schema: any; data: any; type: string; key?: string }) => ctx.data,

  setTransformer(fn: (ctx: any) => any) {
    this._transformer = fn;
  },

  runTransform(schema: any, data: any, type: string, key?: string) {
    return this._transformer({ schema, data, type, key });
  }
};
