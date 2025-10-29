/**
 * Ultra-fast decorator creator utilities
 * Optimized for maximum performance with minimal overhead
 */

import { MiddlewareStore, RoleStore, ScopeStore, ParameterStore } from '../stores/index.js';

/**
 * Create a high-performance middleware decorator
 */
export function createMiddlewareDecorator(
  handler: Function,
  options: {
    priority?: number;
    name?: string;
    condition?: (context: any) => boolean;
  } = {}
) {
  return function(target: any, propertyKey?: string | symbol, descriptor?: PropertyDescriptor) {
    const targetFunc = descriptor?.value ?? target;
    const store = MiddlewareStore.getInstance(targetFunc);
    
    store.add(
      handler, 
      options.priority ?? 0, 
      options.name, 
      options.condition
    );
    
    return descriptor;
  };
}

/**
 * Create a high-performance role decorator
 */
export function createRoleDecorator(...roles: string[]) {
  return function(target: any, propertyKey?: string | symbol, descriptor?: PropertyDescriptor) {
    const targetFunc = descriptor?.value ?? target;
    const store = RoleStore.getInstance(targetFunc);
    
    store.addMany(roles);
    
    return descriptor;
  };
}

/**
 * Create a high-performance scope decorator
 */
export function createScopeDecorator(...scopes: string[]) {
  return function(target: any, propertyKey?: string | symbol, descriptor?: PropertyDescriptor) {
    const targetFunc = descriptor?.value ?? target;
    const store = ScopeStore.getInstance(targetFunc);
    
    store.addMany(scopes);
    
    return descriptor;
  };
}

/**
 * Create a high-performance parameter decorator
 */
export function createParameterDecorator(
  type: Function | string,
  options: {
    name?: string;
    required?: boolean;
    defaultValue?: any;
    validator?: (value: any) => boolean;
    transformer?: (value: any) => any;
  } = {}
) {
  return function(target: any, propertyKey: string | symbol | undefined, parameterIndex: number) {
    const targetFunc = target[propertyKey as string] ?? target;
    const store = ParameterStore.getInstance(targetFunc);
    
    store.add({
      index: parameterIndex,
      type,
      name: options.name,
      required: options.required,
      defaultValue: options.defaultValue,
      validator: options.validator,
      transformer: options.transformer
    });
  };
}

/**
 * Create a method decorator with multiple features
 */
export function createMethodDecorator(config: {
  middleware?: Function[];
  roles?: string[];
  scopes?: string[];
  name?: string;
  priority?: number;
}) {
  return function(target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    const targetFunc = descriptor.value;
    
    if (config.middleware) {
      const middlewareStore = MiddlewareStore.getInstance(targetFunc);
      config.middleware.forEach((handler, index) => {
        middlewareStore.add(handler, (config.priority ?? 0) + index, config.name);
      });
    }
    
    if (config.roles) {
      const roleStore = RoleStore.getInstance(targetFunc);
      roleStore.addMany(config.roles);
    }
    
    if (config.scopes) {
      const scopeStore = ScopeStore.getInstance(targetFunc);
      scopeStore.addMany(config.scopes);
    }
    
    return descriptor;
  };
}

/**
 * Create a class decorator with multiple features
 */
export function createClassDecorator(config: {
  middleware?: Function[];
  roles?: string[];
  scopes?: string[];
  name?: string;
  priority?: number;
}) {
  return function<T extends Function>(constructor: T): T {
    if (config.middleware) {
      const middlewareStore = MiddlewareStore.getInstance(constructor);
      config.middleware.forEach((handler, index) => {
        middlewareStore.add(handler, (config.priority ?? 0) + index, config.name);
      });
    }
    
    if (config.roles) {
      const roleStore = RoleStore.getInstance(constructor);
      roleStore.addMany(config.roles);
    }
    
    if (config.scopes) {
      const scopeStore = ScopeStore.getInstance(constructor);
      scopeStore.addMany(config.scopes);
    }
    
    return constructor;
  };
}