/**
 * Ultra-fast scope management system
 * Optimized for high-performance permission checking
 */

import { setMetadata } from './metadata.store.js';
import { KEY_SCOPES } from '../symbols.constant.js';

export interface ScopeDescriptor {
  readonly name: string;
  readonly description?: string;
  readonly resource?: string;
  readonly actions?: string[];
  readonly level?: number;
}

/**
 * Global scope registry for fast lookups
 */
const GLOBAL_SCOPES = new Map<string, ScopeDescriptor>();

/**
 * High-performance scope store
 */
export class ScopeStore {
  private static readonly instances = new WeakMap<Function, ScopeStore>();
  
  private readonly scopes = new Set<string>();
  private readonly required = new Set<string>();

  /**
   * Get or create store instance for target
   */
  static getInstance(target: Function): ScopeStore {
    let store = this.instances.get(target);
    if (!store) {
      store = new ScopeStore();
      this.instances.set(target, store);
      setMetadata(KEY_SCOPES, store, target);
    }
    return store;
  }

  /**
   * Register scope globally
   */
  static register(scope: ScopeDescriptor): void {
    GLOBAL_SCOPES.set(scope.name, scope);
  }

  /**
   * Get all registered scopes
   */
  static all(): ReadonlyMap<string, ScopeDescriptor> {
    return GLOBAL_SCOPES;
  }

  /**
   * Get scope descriptor
   */
  static getScope(name: string): ScopeDescriptor | undefined {
    return GLOBAL_SCOPES.get(name);
  }

  /**
   * Check if scope exists globally
   */
  static hasScope(name: string): boolean {
    return GLOBAL_SCOPES.has(name);
  }

  /**
   * Register multiple scopes at once
   */
  static registerMany(scopes: ScopeDescriptor[]): void {
    scopes.forEach(scope => this.register(scope));
  }

  /**
   * Add scope to target
   */
  add(scope: string): this {
    this.scopes.add(scope);
    return this;
  }

  /**
   * Add multiple scopes
   */
  addMany(scopes: string[]): this {
    scopes.forEach(scope => this.scopes.add(scope));
    return this;
  }

  /**
   * Set scope as required
   */
  require(scope: string): this {
    this.required.add(scope);
    return this;
  }

  /**
   * Require multiple scopes
   */
  requireMany(scopes: string[]): this {
    scopes.forEach(scope => this.required.add(scope));
    return this;
  }

  /**
   * Check if has scope
   */
  has(scope: string): boolean {
    return this.scopes.has(scope);
  }

  /**
   * Check if scope is required
   */
  isRequired(scope: string): boolean {
    return this.required.has(scope);
  }

  /**
   * Get all scopes as array
   */
  getAll(): string[] {
    return Array.from(this.scopes);
  }

  /**
   * Get required scopes
   */
  getRequired(): string[] {
    return Array.from(this.required);
  }

  /**
   * Check if user has required scopes
   */
  checkUser(userScopes: string[]): boolean {
    if (this.required.size === 0) return true;
    
    const userScopeSet = new Set(userScopes);
    for (const scope of this.required) {
      if (!userScopeSet.has(scope)) return false;
    }
    return true;
  }

  /**
   * Check if user has any of the scopes
   */
  checkUserAny(userScopes: string[]): boolean {
    if (this.scopes.size === 0) return true;
    
    const userScopeSet = new Set(userScopes);
    for (const scope of this.scopes) {
      if (userScopeSet.has(scope)) return true;
    }
    return false;
  }

  /**
   * Remove scope
   */
  remove(scope: string): boolean {
    const hadScope = this.scopes.delete(scope);
    this.required.delete(scope);
    return hadScope;
  }

  /**
   * Clear all scopes
   */
  clear(): void {
    this.scopes.clear();
    this.required.clear();
  }

  /**
   * Get scope count
   */
  get size(): number {
    return this.scopes.size;
  }

  /**
   * Check if empty
   */
  get isEmpty(): boolean {
    return this.scopes.size === 0;
  }
}