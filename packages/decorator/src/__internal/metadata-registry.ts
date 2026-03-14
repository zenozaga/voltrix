import type { Provider, Token } from '@voltrix/injector';

export type Constructor<T = any> = new (...args: any[]) => T;

/**
 * 📝 Metadata for a single route parameter
 */
export interface ParameterMetadata {
  index: number;
  type: string;
  name?: string;
  key?: string;
  schema?: any; // Zod or other schema
  transform?: (...args: any[]) => any;
  options?: any;
}

/**
 * 📝 Metadata for an HTTP route
 */
export interface RouteMetadata {
  method: string;
  path: string;
  propertyKey: string | symbol;
  options?: any;
}

/**
 * 📝 Options for App/Module/Controller
 */
export interface MetadataOptions {
  name?: string;
  version?: string;
  description?: string;
  port?: number;
  modules?: Constructor[];
  controllers?: Constructor[];
  providers?: (Constructor | Provider)[];
  middlewares?: any[]; // Middleware functions
  path?: string;
  prefix?: string;
  imports?: Constructor[];
  [key: string]: any;
}

export interface MetadataBag {
  target: Constructor;
  type?: 'application' | 'module' | 'controller';
  options: MetadataOptions;
  routes: Map<string | symbol, RouteMetadata>;
  parameters: Map<string | symbol, ParameterMetadata[]>;
  middlewares: Map<string | symbol, any[]>;
  custom: Map<string | symbol, Map<string | symbol, any>>;
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
        options: {},
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
  _transformer: (ctx: { schema: any; data: any; type: string; key?: string }): any => ctx.data,

  setTransformer(fn: (ctx: { schema: any; data: any; type: string; key?: string }) => any) {
    this._transformer = fn;
  },

  runTransform(schema: any, data: any, type: string, key?: string): any {
    return this._transformer({ schema, data, type, key });
  }
};
