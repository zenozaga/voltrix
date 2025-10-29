/**
 * Ultra-fast Scope decorator
 * Optimized for maximum performance with minimal overhead
 */

import { ScopeStore } from '../__internal/stores/scope.store.js';

/**
 * High-performance @Scope decorator
 */
export function Scope(...scopes: string[]) {
  return function(target: any, propertyKey?: string | symbol, descriptor?: PropertyDescriptor) {
    const targetFunc = descriptor?.value ?? target;
    const store = ScopeStore.getInstance(targetFunc);
    
    store.addMany(scopes);
    
    return descriptor ?? target;
  };
}

/**
 * Require specific scopes decorator
 */
export function RequireScopes(...scopes: string[]) {
  return function(target: any, propertyKey?: string | symbol, descriptor?: PropertyDescriptor) {
    const targetFunc = descriptor?.value ?? target;
    const store = ScopeStore.getInstance(targetFunc);
    
    scopes.forEach(scope => store.require(scope));
    
    return descriptor ?? target;
  };
}

/**
 * Read scope decorator (shorthand)
 */
export function Read() {
  return Scope('read');
}

/**
 * Write scope decorator (shorthand)
 */
export function Write() {
  return Scope('write');
}

/**
 * Delete scope decorator (shorthand)
 */
export function Delete() {
  return Scope('delete');
}

/**
 * Admin scope decorator (shorthand)
 */
export function AdminScope() {
  return Scope('admin');
}

/**
 * User scope decorator (shorthand)
 */
export function UserScope() {
  return Scope('user');
}

/**
 * Resource-specific read scope
 */
export function ReadResource(resource: string) {
  return Scope(`read:${resource}`);
}

/**
 * Resource-specific write scope
 */
export function WriteResource(resource: string) {
  return Scope(`write:${resource}`);
}

/**
 * Resource-specific delete scope
 */
export function DeleteResource(resource: string) {
  return Scope(`delete:${resource}`);
}

/**
 * Multiple scope options (OR logic)
 */
export function AnyScope(...scopes: string[]) {
  return Scope(...scopes);
}

/**
 * All scopes required (AND logic)
 */
export function AllScopes(...scopes: string[]) {
  return RequireScopes(...scopes);
}

/**
 * Custom scope validation decorator
 */
export function CustomScope(validator: (userScopes: string[], requiredScopes: string[]) => boolean) {
  return function(target: any, propertyKey?: string | symbol, descriptor?: PropertyDescriptor) {
    const targetFunc = descriptor?.value ?? target;
    const store = ScopeStore.getInstance(targetFunc);
    
    // Override the default checkUser method with custom validator
    (store as any).checkUser = (userScopes: string[]) => {
      const requiredScopes = store.getRequired();
      return validator(userScopes, requiredScopes);
    };
    
    return descriptor ?? target;
  };
}

/**
 * Scope inheritance decorator
 */
export function ScopeInheritance(inheritance: Record<string, string[]>) {
  return function(target: any, propertyKey?: string | symbol, descriptor?: PropertyDescriptor) {
    const targetFunc = descriptor?.value ?? target;
    const store = ScopeStore.getInstance(targetFunc);
    
    // Override checkUser to support inheritance
    const originalCheckUser = store.checkUser.bind(store);
    (store as any).checkUser = (userScopes: string[]) => {
      // Expand user scopes based on inheritance
      const expandedScopes = new Set(userScopes);
      
      for (const scope of userScopes) {
        const childScopes = inheritance[scope];
        if (childScopes) {
          childScopes.forEach(childScope => expandedScopes.add(childScope));
        }
      }
      
      return originalCheckUser(Array.from(expandedScopes));
    };
    
    return descriptor ?? target;
  };
}

/**
 * Full access scope (all permissions)
 */
export function FullAccess() {
  return Scope('*');
}

/**
 * No access scope (deny all)
 */
export function NoAccess() {
  return function(target: any, propertyKey?: string | symbol, descriptor?: PropertyDescriptor) {
    const targetFunc = descriptor?.value ?? target;
    const store = ScopeStore.getInstance(targetFunc);
    
    // Add a special "deny" scope
    store.add('__deny__');
    
    return descriptor ?? target;
  };
}

/**
 * Temporary scope with expiration
 */
export function TemporaryScope(scope: string, expiresInMinutes: number) {
  return function(target: any, propertyKey?: string | symbol, descriptor?: PropertyDescriptor) {
    const targetFunc = descriptor?.value ?? target;
    const store = ScopeStore.getInstance(targetFunc);
    
    // Add scope with expiration timestamp
    const expirationTime = Date.now() + (expiresInMinutes * 60 * 1000);
    const temporaryScope = `${scope}:expires:${expirationTime}`;
    
    store.add(temporaryScope);
    
    return descriptor ?? target;
  };
}

/**
 * Context-dependent scope
 */
export function ContextScope(contextProvider: () => string[]) {
  return function(target: any, propertyKey?: string | symbol, descriptor?: PropertyDescriptor) {
    const targetFunc = descriptor?.value ?? target;
    const store = ScopeStore.getInstance(targetFunc);
    
    // Override checkUser to get context-dependent scopes
    const originalCheckUser = store.checkUser.bind(store);
    (store as any).checkUser = (userScopes: string[]) => {
      const contextScopes = contextProvider();
      const combinedScopes = [...userScopes, ...contextScopes];
      return originalCheckUser(combinedScopes);
    };
    
    return descriptor ?? target;
  };
}
//   <T extends string = string>( scopes: ScopeType<T> ): ClassDecorator & MethodDecorator & ParameterDecorator =>
//   (target: any, propertyKey?: any, descriptorOrIndex?: any) => {
//     const { isProperty } = who(target, propertyKey, descriptorOrIndex);

//     if (isProperty) {
//       throw new Error(
//         `Scope decorator cannot be used as parameter decorator in ${target.constructor.name}.${propertyKey}`
//       );
//     }

//     const list = MetadatStore.list<ScopeType>(KEY_PARAMS_SCOPE, {
//       target,
//       propertyKey,
//     });

//     list.set(...(Array.isArray(scopes) ? scopes : [scopes]));
//   };
