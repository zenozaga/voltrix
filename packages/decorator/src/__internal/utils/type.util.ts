/**
 * Ultra-fast type utilities
 * Optimized for high-performance type checking
 */

/**
 * Fast type checking
 */
export function isFunction(value: any): value is Function {
  return typeof value === 'function';
}

export function isObject(value: any): value is object {
  return value !== null && typeof value === 'object';
}

export function isString(value: any): value is string {
  return typeof value === 'string';
}

export function isNumber(value: any): value is number {
  return typeof value === 'number' && !isNaN(value);
}

export function isBoolean(value: any): value is boolean {
  return typeof value === 'boolean';
}

export function isArray(value: any): value is any[] {
  return Array.isArray(value);
}

export function isUndefined(value: any): value is undefined {
  return value === undefined;
}

export function isNull(value: any): value is null {
  return value === null;
}

export function isNullOrUndefined(value: any): value is null | undefined {
  return value === null || value === undefined;
}

/**
 * Fast class/constructor checking
 */
export function isClass(value: any): boolean {
  return isFunction(value) && value.toString().startsWith('class ');
}

export function isConstructor(value: any): boolean {
  return isFunction(value) && value.prototype && value.prototype.constructor === value;
}

/**
 * Fast property existence checking
 */
export function hasProperty(obj: any, prop: string): boolean {
  return obj != null && Object.prototype.hasOwnProperty.call(obj, prop);
}

export function hasMethod(obj: any, method: string): boolean {
  return hasProperty(obj, method) && isFunction(obj[method]);
}

/**
 * Fast prototype checking
 */
export function isInstanceOf(obj: any, constructor: Function): boolean {
  if (!isObject(obj) || !isFunction(constructor)) return false;
  return obj instanceof constructor;
}

/**
 * Fast primitive checking
 */
export function isPrimitive(value: any): boolean {
  return value !== Object(value);
}

/**
 * Fast empty checking
 */
export function isEmpty(value: any): boolean {
  if (isNullOrUndefined(value)) return true;
  if (isString(value) || isArray(value)) return value.length === 0;
  if (isObject(value)) return Object.keys(value).length === 0;
  return false;
}

/**
 * Fast deep equality check (for simple objects)
 */
export function isEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (isNullOrUndefined(a) || isNullOrUndefined(b)) return a === b;
  if (typeof a !== typeof b) return false;
  
  if (isArray(a) && isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!isEqual(a[i], b[i])) return false;
    }
    return true;
  }
  
  if (isObject(a) && isObject(b)) {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    
    for (const key of keysA) {
      if (!hasProperty(b, key) || !isEqual((a as any)[key], (b as any)[key])) return false;
    }
    return true;
  }
  
  return false;
}