/**
 * 🔐 Security Registry
 * Centralized tracking for scopes and roles.
 * Uses globalThis to ensure singleton behavior across multiple module loads.
 */

const GLOBAL_KEY = Symbol.for('__VOLTRIX_SECURITY_REGISTRY__');

interface SecurityState {
  id: string;
  usedScopes: any[];
  usedRoles: any[];
}

const state: SecurityState = (globalThis as any)[GLOBAL_KEY] || {
  id: Math.random().toString(36).substring(7),
  usedScopes: [],
  usedRoles: []
};

(globalThis as any)[GLOBAL_KEY] = state;

export const SecurityRegistry = {
  registerScopes(scopes: any[]) {
    scopes.forEach(s => {
      // For objects, we check if equivalent already exists to avoid duplicates
      const exists = state.usedScopes.some(existing => 
        JSON.stringify(existing) === JSON.stringify(s)
      );
      if (!exists) state.usedScopes.push(s);
    });
  },

  registerRoles(roles: any[]) {
    roles.forEach(r => {
      const exists = state.usedRoles.some(existing => 
        JSON.stringify(existing) === JSON.stringify(r)
      );
      if (!exists) state.usedRoles.push(r);
    });
  },

  getAllScopes(): any[] {
    return [...state.usedScopes];
  },

  getAllRoles(): any[] {
    return [...state.usedRoles];
  }
};
