/**
 * Ultra-fast parameter metadata store
 * Optimized for high-performance parameter injection
 */

import {  setMetadata } from './metadata.store.js';
import { KEY_PARAMS } from '../symbols.constant.js';

export interface ParameterDescriptor {
  readonly index: number;
  readonly type: Function | string;
  readonly name?: string;
  readonly required?: boolean;
  readonly defaultValue?: any;
  readonly validator?: (value: any) => boolean;
  readonly transformer?: (value: any) => any;
}

/**
 * High-performance parameter store
 */
export class ParameterStore {
  private static readonly instances = new WeakMap<Function, ParameterStore>();
  
  private readonly parameters = new Map<number, ParameterDescriptor>();
  private sorted = true;
  private cachedArray: ParameterDescriptor[] = [];

  /**
   * Get or create store instance for target
   */
  static getInstance(target: Function): ParameterStore {
    let store = this.instances.get(target);
    if (!store) {
      store = new ParameterStore();
      this.instances.set(target, store);
      setMetadata(KEY_PARAMS, store, target);
    }
    return store;
  }

  /**
   * Add parameter metadata
   */
  add(descriptor: ParameterDescriptor): this {
    this.parameters.set(descriptor.index, descriptor);
    this.sorted = false;
    return this;
  }

  /**
   * Get parameter by index
   */
  get(index: number): ParameterDescriptor | undefined {
    return this.parameters.get(index);
  }

  /**
   * Get all parameters sorted by index
   */
  getAll(): readonly ParameterDescriptor[] {
    if (!this.sorted) {
      this.cachedArray = Array.from(this.parameters.values())
        .sort((a, b) => a.index - b.index);
      this.sorted = true;
    }
    return this.cachedArray;
  }

  /**
   * Get parameter names in order
   */
  getNames(): (string | undefined)[] {
    return this.getAll().map(p => p.name);
  }

  /**
   * Get parameter types in order
   */
  getTypes(): (Function | string)[] {
    return this.getAll().map(p => p.type);
  }

  /**
   * Validate parameter value
   */
  validate(index: number, value: any): boolean {
    const param = this.parameters.get(index);
    if (!param) return true;
    
    if (param.required && (value === undefined || value === null)) {
      return false;
    }
    
    return param.validator ? param.validator(value) : true;
  }

  /**
   * Transform parameter value
   */
  transform(index: number, value: any): any {
    const param = this.parameters.get(index);
    if (!param) return value;
    
    if (value === undefined && param.defaultValue !== undefined) {
      value = param.defaultValue;
    }
    
    return param.transformer ? param.transformer(value) : value;
  }

  /**
   * Process all parameters with validation and transformation
   */
  processArgs(args: any[]): any[] {
    const result = [...args];
    const params = this.getAll();
    
    for (const param of params) {
      if (!param) continue;
      
      const value = result[param.index];
      
      // Validate
      if (!this.validate(param.index, value)) {
        throw new Error(`Invalid parameter at index ${param.index}${param.name ? ` (${param.name})` : ''}`);
      }
      
      // Transform
      result[param.index] = this.transform(param.index, value);
    }
    
    return result;
  }

  /**
   * Remove parameter
   */
  remove(index: number): boolean {
    const removed = this.parameters.delete(index);
    if (removed) {
      this.sorted = false;
    }
    return removed;
  }

  /**
   * Clear all parameters
   */
  clear(): void {
    this.parameters.clear();
    this.sorted = true;
    this.cachedArray = [];
  }

  /**
   * Get parameter count
   */
  get size(): number {
    return this.parameters.size;
  }

  /**
   * Check if empty
   */
  get isEmpty(): boolean {
    return this.parameters.size === 0;
  }
}