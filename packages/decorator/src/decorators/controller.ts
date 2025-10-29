/**
 * Ultra-fast Controller decorator
 * Optimized for maximum performance with minimal overhead
 */

import { getMetadataStore } from '../__internal/stores/metadata.store.js';
import { MiddlewareStore } from '../__internal/stores/middleware.store.js';

// Controller metadata keys
const CONTROLLER_PREFIX = Symbol('controllerPrefix');
const CONTROLLER_VERSION = Symbol('controllerVersion');
const CONTROLLER_TAGS = Symbol('controllerTags');

/**
 * High-performance @Controller decorator
 */
export function Controller(prefix?: string) {
  return function(target: any) {
    const store = getMetadataStore(target);
    
    if (prefix) {
      store.set(CONTROLLER_PREFIX, prefix);
    }
    
    // Mark as controller
    store.set(Symbol('isController'), true);
    
    return target;
  };
}

/**
 * API version decorator
 */
export function Version(version: string) {
  return function(target: any) {
    const store = getMetadataStore(target);
    
    store.set(CONTROLLER_VERSION, version);
    
    return target;
  };
}

/**
 * Controller tags for documentation
 */
export function Tags(...tags: string[]) {
  return function(target: any) {
    const store = getMetadataStore(target);
    
    store.set(CONTROLLER_TAGS, tags);
    
    return target;
  };
}

/**
 * API prefix decorator (alias for Controller)
 */
export function ApiPrefix(prefix: string) {
  return Controller(prefix);
}

/**
 * REST resource controller
 */
export function Resource(name: string, options?: { 
  prefix?: string; 
  version?: string; 
  only?: string[]; 
  except?: string[]; 
}) {
  return function(target: any) {
    const store = getMetadataStore(target);
    
    // Set resource name
    store.set(Symbol('resourceName'), name);
    
    // Set prefix if provided
    if (options?.prefix) {
      store.set(CONTROLLER_PREFIX, options.prefix);
    } else {
      store.set(CONTROLLER_PREFIX, `/${name}`);
    }
    
    // Set version if provided
    if (options?.version) {
      store.set(CONTROLLER_VERSION, options.version);
    }
    
    // Set allowed/excluded actions
    if (options?.only) {
      store.set(Symbol('resourceOnly'), options.only);
    }
    
    if (options?.except) {
      store.set(Symbol('resourceExcept'), options.except);
    }
    
    return target;
  };
}

/**
 * Middleware for entire controller
 */
export function UseMiddleware(...middlewares: Function[]) {
  return function(target: any) {
    const store = MiddlewareStore.getInstance(target);
    
    middlewares.forEach(middleware => {
      store.add(middleware, 0); // Controller-level middleware has priority 0
    });
    
    return target;
  };
}

/**
 * Guards for controller
 */
export function UseGuards(...guards: Function[]) {
  return function(target: any) {
    const store = MiddlewareStore.getInstance(target);
    
    guards.forEach(guard => {
      store.add(guard, -10); // Guards run before other middleware
    });
    
    return target;
  };
}

/**
 * Interceptors for controller
 */
export function UseInterceptors(...interceptors: Function[]) {
  return function(target: any) {
    const store = MiddlewareStore.getInstance(target);
    
    interceptors.forEach(interceptor => {
      store.add(interceptor, 100); // Interceptors run after other middleware
    });
    
    return target;
  };
}

/**
 * Filters for controller
 */
export function UseFilters(...filters: Function[]) {
  return function(target: any) {
    const store = MiddlewareStore.getInstance(target);
    
    filters.forEach(filter => {
      store.add(filter, 200); // Filters run last
    });
    
    return target;
  };
}
