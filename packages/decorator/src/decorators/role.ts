/**
 * Ultra-fast Role decorator
 * Optimized for maximum performance with minimal overhead
 */

import { RoleStore } from '../__internal/stores/role.store.js';

/**
 * High-performance @Role decorator
 */
export function Role(...roles: string[]) {
  return function(target: any, propertyKey?: string | symbol, descriptor?: PropertyDescriptor) {
    const targetFunc = descriptor?.value ?? target;
    const store = RoleStore.getInstance(targetFunc);
    
    store.addMany(roles);
    
    return descriptor ?? target;
  };
}

/**
 * Require specific roles decorator
 */
export function RequireRoles(...roles: string[]) {
  return function(target: any, propertyKey?: string | symbol, descriptor?: PropertyDescriptor) {
    const targetFunc = descriptor?.value ?? target;
    const store = RoleStore.getInstance(targetFunc);
    
    roles.forEach(role => store.require(role));
    
    return descriptor ?? target;
  };
}

/**
 * Admin role decorator (shorthand)
 */
export function Admin() {
  return Role('admin');
}

/**
 * User role decorator (shorthand)
 */
export function User() {
  return Role('user');
}

/**
 * Moderator role decorator (shorthand)
 */
export function Moderator() {
  return Role('moderator');
}

/**
 * Owner role decorator (shorthand)
 */
export function Owner() {
  return Role('owner');
}

/**
 * Multiple role options (OR logic)
 */
export function AnyRole(...roles: string[]) {
  return Role(...roles);
}

/**
 * All roles required (AND logic)
 */
export function AllRoles(...roles: string[]) {
  return RequireRoles(...roles);
}

/**
 * Custom role validation decorator
 */
export function CustomRole(validator: (userRoles: string[], requiredRoles: string[]) => boolean) {
  return function(target: any, propertyKey?: string | symbol, descriptor?: PropertyDescriptor) {
    const targetFunc = descriptor?.value ?? target;
    const store = RoleStore.getInstance(targetFunc);
    
    // Override the default checkUser method with custom validator
    (store as any).checkUser = (userRoles: string[]) => {
      const requiredRoles = store.getRequired();
      return validator(userRoles, requiredRoles);
    };
    
    return descriptor ?? target;
  };
}

/**
 * Role hierarchy decorator
 */
export function RoleHierarchy(hierarchy: Record<string, string[]>) {
  return function(target: any, propertyKey?: string | symbol, descriptor?: PropertyDescriptor) {
    const targetFunc = descriptor?.value ?? target;
    const store = RoleStore.getInstance(targetFunc);
    
    // Override checkUser to support hierarchy
    const originalCheckUser = store.checkUser.bind(store);
    (store as any).checkUser = (userRoles: string[]) => {
      // Expand user roles based on hierarchy
      const expandedRoles = new Set(userRoles);
      
      for (const role of userRoles) {
        const childRoles = hierarchy[role];
        if (childRoles) {
          childRoles.forEach(childRole => expandedRoles.add(childRole));
        }
      }
      
      return originalCheckUser(Array.from(expandedRoles));
    };
    
    return descriptor ?? target;
  };
}

/**
 * Public access decorator (no roles required)
 */
export function Public() {
  return function(target: any, propertyKey?: string | symbol, descriptor?: PropertyDescriptor) {
    const targetFunc = descriptor?.value ?? target;
    const store = RoleStore.getInstance(targetFunc);
    
    // Clear all roles to make it public
    store.clear();
    
    return descriptor ?? target;
  };
}

/**
 * Protected access decorator (requires authentication but no specific roles)
 */
export function Protected() {
  return function(target: any, propertyKey?: string | symbol, descriptor?: PropertyDescriptor) {
    const targetFunc = descriptor?.value ?? target;
    const store = RoleStore.getInstance(targetFunc);
    
    // Add a special "authenticated" requirement
    store.add('authenticated');
    
    return descriptor ?? target;
  };
}
