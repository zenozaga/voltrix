import { Metadata, type Provider, type Token, type Constructor } from '@voltrix/core';
export type { Provider, Token, Constructor }

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
 * Key used to store the MetadataBag on the class-level metadata record.
 */
const BAG_KEY = 'voltrix:bag';

/**
 * Key used to scope class-level (vs method-level) metadata in all Maps inside MetadataBag.
 * Export this instead of scattering the '@@global' literal everywhere.
 */
export const CLASS_KEY = '@@global';

/**
 * Keys used in bag.custom to store security metadata.
 * Using constants prevents silent typo bugs.
 */
export const CUSTOM_KEYS = {
  SCOPES: 'scopes',
  ROLES: 'roles',
  PUBLIC: 'public',
} as const;

export class MetadataRegistry {
  /**
   * Get or create a metadata bag for a target
   */
  static getOrCreate(target: Constructor): MetadataBag {
    const meta = Metadata.get(target);
    if (!meta[BAG_KEY]) {
      meta[BAG_KEY] = {
        target,
        options: {},
        routes: new Map(),
        parameters: new Map(),
        middlewares: new Map(),
        custom: new Map(),
      };
    }
    return meta[BAG_KEY];
  }

  /**
   * Get an existing metadata bag
   */
  static get(target: Constructor): MetadataBag | undefined {
    return Metadata.get(target)[BAG_KEY];
  }

  /**
   * Get all annotated classes in the system from the global core index
   */
  static getClasses(): Constructor[] {
    return Metadata.getTrackedClasses();
  }
}
