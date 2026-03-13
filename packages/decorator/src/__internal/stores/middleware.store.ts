/**
 * Ultra-fast middleware store with array optimization
 * Designed for high-performance middleware stacking
 */

import { setMetadata } from './metadata.store.js';
import { KEY_MIDDLEWARE } from '../symbols.constant.js';

export interface MiddlewareDescriptor {
  readonly handler: Function;
  readonly priority: number;
  readonly name?: string;
  readonly condition?: (context: any) => boolean;
}

/**
 * High-performance middleware store
 */
export class MiddlewareStore {
  private static readonly instances = new WeakMap<Function, MiddlewareStore>();

  private readonly middlewares: MiddlewareDescriptor[] = [];
  private sorted = true;

  /**
   * Get or create store instance for target
   */
  static getInstance(target: Function): MiddlewareStore {
    let store = this.instances.get(target);
    if (!store) {
      store = new MiddlewareStore();
      this.instances.set(target, store);
      setMetadata(KEY_MIDDLEWARE, store, target);
    }
    return store;
  }

  /**
   * Add middleware with priority (higher = runs first)
   */
  add(handler: Function, priority = 0, name?: string, condition?: (context: any) => boolean): this {
    this.middlewares.push({ handler, priority, name, condition });
    this.sorted = false;
    return this;
  }

  /**
   * Get all middlewares sorted by priority
   */
  getAll(): readonly MiddlewareDescriptor[] {
    if (!this.sorted) {
      this.middlewares.sort((a, b) => b.priority - a.priority);
      this.sorted = true;
    }
    return this.middlewares;
  }

  /**
   * Get middleware handlers only (optimized for execution)
   */
  getHandlers(): Function[] {
    return this.getAll().map(m => m.handler);
  }

  /**
   * Get conditional middlewares for context
   */
  getConditional(context: any): Function[] {
    return this.getAll()
      .filter(m => !m.condition || m.condition(context))
      .map(m => m.handler);
  }

  /**
   * Remove middleware by name
   */
  remove(name: string): boolean {
    const index = this.middlewares.findIndex(m => m.name === name);
    if (index !== -1) {
      this.middlewares.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Clear all middlewares
   */
  clear(): void {
    this.middlewares.length = 0;
    this.sorted = true;
  }

  /**
   * Get middleware count
   */
  get size(): number {
    return this.middlewares.length;
  }

  /**
   * Check if has middlewares
   */
  get isEmpty(): boolean {
    return this.middlewares.length === 0;
  }
}
