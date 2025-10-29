/**
 * Ultra-fast Module decorator
 * Optimized for maximum performance with minimal overhead
 */

import { getMetadataStore } from '../__internal/stores/metadata.store.js';

// Module metadata keys
const MODULE_IMPORTS = Symbol('moduleImports');
const MODULE_PROVIDERS = Symbol('moduleProviders');
const MODULE_CONTROLLERS = Symbol('moduleControllers');
const MODULE_EXPORTS = Symbol('moduleExports');
const MODULE_GLOBAL = Symbol('moduleGlobal');

/**
 * Module configuration interface
 */
export interface ModuleMetadata {
  imports?: any[];
  providers?: any[];
  controllers?: any[];
  exports?: any[];
  global?: boolean;
}

/**
 * High-performance @Module decorator
 */
export function Module(metadata: ModuleMetadata) {
  return function(target: any) {
    const store = getMetadataStore(target);
    
    // Set module metadata
    if (metadata.imports) {
      store.set(MODULE_IMPORTS, metadata.imports);
    }
    
    if (metadata.providers) {
      store.set(MODULE_PROVIDERS, metadata.providers);
    }
    
    if (metadata.controllers) {
      store.set(MODULE_CONTROLLERS, metadata.controllers);
    }
    
    if (metadata.exports) {
      store.set(MODULE_EXPORTS, metadata.exports);
    }
    
    if (metadata.global) {
      store.set(MODULE_GLOBAL, true);
    }
    
    // Mark as module
    store.set(Symbol('isModule'), true);
    
    return target;
  };
}

/**
 * Global module decorator
 */
export function Global() {
  return function(target: any) {
    const store = getMetadataStore(target);
    
    store.set(MODULE_GLOBAL, true);
    
    return target;
  };
}

/**
 * Dynamic module interface
 */
export interface DynamicModule extends ModuleMetadata {
  module: any;
}

/**
 * Create dynamic module
 */
export function createDynamicModule(metadata: DynamicModule): any {
  const store = getMetadataStore(metadata.module);
  
  // Set dynamic module metadata
  if (metadata.imports) {
    store.set(MODULE_IMPORTS, metadata.imports);
  }
  
  if (metadata.providers) {
    store.set(MODULE_PROVIDERS, metadata.providers);
  }
  
  if (metadata.controllers) {
    store.set(MODULE_CONTROLLERS, metadata.controllers);
  }
  
  if (metadata.exports) {
    store.set(MODULE_EXPORTS, metadata.exports);
  }
  
  if (metadata.global) {
    store.set(MODULE_GLOBAL, true);
  }
  
  return metadata.module;
}

/**
 * Feature module decorator
 */
export function FeatureModule(name: string, metadata?: Omit<ModuleMetadata, 'global'>) {
  return function(target: any) {
    const store = getMetadataStore(target);
    
    // Set feature name
    store.set(Symbol('featureName'), name);
    
    // Apply metadata if provided
    if (metadata) {
      if (metadata.imports) {
        store.set(MODULE_IMPORTS, metadata.imports);
      }
      
      if (metadata.providers) {
        store.set(MODULE_PROVIDERS, metadata.providers);
      }
      
      if (metadata.controllers) {
        store.set(MODULE_CONTROLLERS, metadata.controllers);
      }
      
      if (metadata.exports) {
        store.set(MODULE_EXPORTS, metadata.exports);
      }
    }
    
    return target;
  };
}

/**
 * Core module decorator (always global)
 */
export function CoreModule(metadata?: Omit<ModuleMetadata, 'global'>) {
  return function(target: any) {
    const store = getMetadataStore(target);
    
    // Mark as core module (always global)
    store.set(MODULE_GLOBAL, true);
    store.set(Symbol('isCoreModule'), true);
    
    // Apply metadata if provided
    if (metadata) {
      if (metadata.imports) {
        store.set(MODULE_IMPORTS, metadata.imports);
      }
      
      if (metadata.providers) {
        store.set(MODULE_PROVIDERS, metadata.providers);
      }
      
      if (metadata.controllers) {
        store.set(MODULE_CONTROLLERS, metadata.controllers);
      }
      
      if (metadata.exports) {
        store.set(MODULE_EXPORTS, metadata.exports);
      }
    }
    
    return target;
  };
}
