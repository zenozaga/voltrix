import type { Constructor, Token } from './providers';

export const META = {
  INJECT: Symbol('inject'),
  INJECTABLE: Symbol('injectable'),
  INJECT_OPTIONAL: Symbol('inject:optional'),
  INJECT_TOKENS: Symbol('inject:tokens'),
  INJECT_PROPS: Symbol('inject:properties'),
  SCOPE: Symbol('scope'),
  LIFETIME: Symbol('lifetime'),
  TIMEOUT: Symbol('timeout'),
} as const;

const paramTypesCache: WeakMap<Constructor, any[] | null> = new WeakMap();

/**
 * Returns constructor parameter types using Reflect metadata.
 * Cached for faster subsequent calls.
 */
export function getDesignParamTypes(target: Constructor): any[] | null {
  if (paramTypesCache.has(target)) return paramTypesCache.get(target)!;

  // Reflect metadata is always available after importing "reflect-metadata"
  const result = Reflect.getMetadata('design:paramtypes', target) || null;
  paramTypesCache.set(target, result);


  return result;
}

/**
 * Returns manually injected tokens defined by @Inject.
 */
export function getInjectedTokens(proto: object): Token[] | undefined {
  return Reflect.getOwnMetadata?.(META.INJECT_TOKENS, proto);
}

export function getInjectedProps<T = unknown>(
  target: Constructor<T>
): Array<{ key: string | symbol; token: unknown; optional?: boolean }> | undefined {
  return Reflect.getOwnMetadata?.(META.INJECT_PROPS, target);
}


export function getInjectedOptional(
  target: object,
  index: number
): boolean | undefined {
  return Reflect.getOwnMetadata?.(META.INJECT_OPTIONAL, target, index.toString()) === true;
}

/**
 * Defines metadata safely.
 */
export function defineMetadata(key: symbol, value: unknown, target: object) {
  Reflect.defineMetadata?.(key, value, target);
}

/**
 * Gets metadata safely.
 */
export function getMetadata<T = unknown>(key: symbol, target: object): T | undefined {
  return Reflect.getMetadata?.(key, target) as T | undefined;
}

/**
 * Returns all metadata keys and values from a target.
 */
export function getAllMetadata<T = unknown>(target: object): Map<symbol, T> {
  const map = new Map<symbol, T>();
  const keys: symbol[] = Reflect.getMetadataKeys?.(target) ?? [];
  for (const key of keys) {
    const value = Reflect.getMetadata?.(key, target) as T;
    map.set(key, value);
  }
  return map;
}

/**
 * Checks if metadata value equals the provided one.
 */
export function isMetadataEqual<T = unknown>(key: symbol, value: T, target: object): boolean {
  const existing = getMetadata<T>(key, target);
  if (existing === undefined) return false;
  return JSON.stringify(existing) === JSON.stringify(value);
}
