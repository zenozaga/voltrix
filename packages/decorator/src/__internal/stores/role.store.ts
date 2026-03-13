/**
 * Ultra-fast role management system
 * Optimized for high-performance role checking
 */

import { setMetadata } from './metadata.store.js';
import { KEY_ROLES } from '../symbols.constant.js';

export interface RoleDescriptor {
  readonly name: string;
  readonly permissions?: string[];
  readonly parent?: string;
  readonly level?: number;
}

/**
 * Global role registry for fast lookups
 */
const GLOBAL_ROLES = new Map<string, RoleDescriptor>();

/**
 * High-performance role store
 */
export class RoleStore {
  private static readonly instances = new WeakMap<Function, RoleStore>();
  
  private readonly roles = new Set<string>();
  private readonly required = new Set<string>();

  /**
   * Get or create store instance for target
   */
  static getInstance(target: Function): RoleStore {
    let store = this.instances.get(target);
    if (!store) {
      store = new RoleStore();
      this.instances.set(target, store);
      setMetadata(KEY_ROLES, store, target);
    }
    return store;
  }

  /**
   * Register role globally
   */
  static register(role: RoleDescriptor): void {
    GLOBAL_ROLES.set(role.name, role);
  }

  /**
   * Get all registered roles
   */
  static all(): ReadonlyMap<string, RoleDescriptor> {
    return GLOBAL_ROLES;
  }

  /**
   * Get role descriptor
   */
  static getRole(name: string): RoleDescriptor | undefined {
    return GLOBAL_ROLES.get(name);
  }

  /**
   * Check if role exists globally
   */
  static hasRole(name: string): boolean {
    return GLOBAL_ROLES.has(name);
  }

  /**
   * Add role to target
   */
  add(role: string): this {
    this.roles.add(role);
    return this;
  }

  /**
   * Add multiple roles
   */
  addMany(roles: string[]): this {
    roles.forEach(role => this.roles.add(role));
    return this;
  }

  /**
   * Set role as required
   */
  require(role: string): this {
    this.required.add(role);
    return this;
  }

  /**
   * Check if has role
   */
  has(role: string): boolean {
    return this.roles.has(role);
  }

  /**
   * Check if role is required
   */
  isRequired(role: string): boolean {
    return this.required.has(role);
  }

  /**
   * Get all roles as array
   */
  getAll(): string[] {
    return Array.from(this.roles);
  }

  /**
   * Get required roles
   */
  getRequired(): string[] {
    return Array.from(this.required);
  }

  /**
   * Check if user has required roles
   */
  checkUser(userRoles: string[]): boolean {
    if (this.required.size === 0) return true;
    
    const userRoleSet = new Set(userRoles);
    for (const role of this.required) {
      if (!userRoleSet.has(role)) return false;
    }
    return true;
  }

  /**
   * Remove role
   */
  remove(role: string): boolean {
    const hadRole = this.roles.delete(role);
    this.required.delete(role);
    return hadRole;
  }

  /**
   * Clear all roles
   */
  clear(): void {
    this.roles.clear();
    this.required.clear();
  }

  /**
   * Get role count
   */
  get size(): number {
    return this.roles.size;
  }

  /**
   * Check if empty
   */
  get isEmpty(): boolean {
    return this.roles.size === 0;
  }
}