import { describe, it, expect, beforeEach } from 'vitest';
import { SecurityRegistry } from '../src/security';

describe('SecurityRegistry', () => {
  beforeEach(() => {
    // We don't have a clear method, but we can access the global state if needed
    // or just assume we start fresh or handle existing state.
    // Since it's a singleton using globalThis, we should be careful.
    // For testing, we can just check if new registrations are added and deduplicated.
  });

  it('should register and retrieve scopes', () => {
    const initialCount = SecurityRegistry.getAllScopes().length;
    SecurityRegistry.registerScopes(['read:users', 'write:users']);
    
    const scopes = SecurityRegistry.getAllScopes();
    expect(scopes).toContain('read:users');
    expect(scopes).toContain('write:users');
    expect(scopes.length).toBeGreaterThanOrEqual(initialCount + 2);
  });

  it('should deduplicate scopes using JSON stringification', () => {
    const scopeObj = { id: 'admin', permission: 'full' };
    SecurityRegistry.registerScopes([scopeObj]);
    const countAfterFirst = SecurityRegistry.getAllScopes().length;
    
    // Register same object again
    SecurityRegistry.registerScopes([{ id: 'admin', permission: 'full' }]);
    expect(SecurityRegistry.getAllScopes().length).toBe(countAfterFirst);
  });

  it('should register and retrieve roles', () => {
    const initialCount = SecurityRegistry.getAllRoles().length;
    SecurityRegistry.registerRoles(['admin', 'user']);
    
    const roles = SecurityRegistry.getAllRoles();
    expect(roles).toContain('admin');
    expect(roles).toContain('user');
    expect(roles.length).toBeGreaterThanOrEqual(initialCount + 2);
  });

  it('should deduplicate roles', () => {
    SecurityRegistry.registerRoles(['manager']);
    const countAfterFirst = SecurityRegistry.getAllRoles().length;
    
    SecurityRegistry.registerRoles(['manager']);
    expect(SecurityRegistry.getAllRoles().length).toBe(countAfterFirst);
  });

  it('should maintain singleton behavior via globalThis', () => {
    const GLOBAL_KEY = Symbol.for('__VOLTRIX_SECURITY_REGISTRY__');
    const state = (globalThis as any)[GLOBAL_KEY];
    
    expect(state).toBeDefined();
    expect(Array.isArray(state.usedScopes)).toBe(true);
    expect(Array.isArray(state.usedRoles)).toBe(true);
  });
});
