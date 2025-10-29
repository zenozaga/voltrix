/**
 * Ultra-fast object utilities
 * Optimized for high-performance object manipulation
 */

/**
 * Fast object iteration with early exit support
 */
export function fastEach<T>(
  obj: Record<string, T>, 
  callback: (value: T, key: string) => boolean | void
): void {
  const keys = Object.keys(obj);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]!;
    const value = obj[key];
    if (value !== undefined && callback(value, key) === false) break;
  }
}

/**
 * Fast object mapping
 */
export function fastMap<T, R>(
  obj: Record<string, T>, 
  callback: (value: T, key: string) => R
): R[] {
  const keys = Object.keys(obj);
  const result = new Array(keys.length);
  
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]!;
    const value = obj[key];
    if (value !== undefined) {
      result[i] = callback(value, key);
    }
  }
  
  return result;
}

/**
 * Fast object filtering
 */
export function fastFilter<T>(
  obj: Record<string, T>, 
  predicate: (value: T, key: string) => boolean
): Record<string, T> {
  const result: Record<string, T> = {};
  const keys = Object.keys(obj);
  
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]!;
    const value = obj[key];
    if (value !== undefined && predicate(value, key)) {
      result[key] = value;
    }
  }
  
  return result;
}

/**
 * Fast deep clone for simple objects
 */
export function fastClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime()) as T;
  if (obj instanceof Array) return obj.map(item => fastClone(item)) as T;
  
  const cloned = {} as T;
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      cloned[key] = fastClone(obj[key]);
    }
  }
  
  return cloned;
}

/**
 * Fast object merge (shallow)
 */
export function fastMerge<T extends Record<string, any>>(
  target: T, 
  ...sources: Partial<T>[]
): T {
  for (let i = 0; i < sources.length; i++) {
    const source = sources[i];
    if (source) {
      const keys = Object.keys(source);
      for (let j = 0; j < keys.length; j++) {
        const key = keys[j];
        target[key as keyof T] = source[key as keyof T] as T[keyof T];
      }
    }
  }
  return target;
}

/**
 * Fast object property checker
 */
export function hasOwnProp(obj: any, prop: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

/**
 * Fast property getter with default
 */
export function getProp<T>(obj: any, prop: string, defaultValue: T): T {
  return hasOwnProp(obj, prop) ? obj[prop] : defaultValue;
}

/**
 * Fast nested property getter
 */
export function getNestedProp(obj: any, path: string, delimiter = '.'): any {
  const parts = path.split(delimiter);
  let current = obj;
  
  for (let i = 0; i < parts.length; i++) {
    if (current === null || current === undefined) return undefined;
    const part = parts[i];
    if (part !== undefined) {
      current = current[part];
    }
  }
  
  return current;
}

/**
 * Fast object size calculation
 */
export function getObjectSize(obj: Record<string, any>): number {
  return Object.keys(obj).length;
}

/**
 * Fast object emptiness check
 */
export function isEmpty(obj: Record<string, any>): boolean {
  for (const key in obj) {
    if (hasOwnProp(obj, key)) return false;
  }
  return true;
}

