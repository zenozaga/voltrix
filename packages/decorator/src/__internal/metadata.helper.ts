import 'reflect-metadata';

/**
 * Internal Metadata Helper
 * These helpers are NOT exposed to the Voltrix user
 */

export function $get(metaKey: string | symbol, target: any, propertyKey?: string | symbol) {
  return Reflect.getMetadata(metaKey, target, propertyKey!) ?? undefined;
}

export function $has(metaKey: string | symbol, target: any, propertyKey?: string | symbol) {
  return Reflect.hasMetadata(metaKey, target, propertyKey!);
}

export function $getOrCreate<T = any>(
  metaKey: string | symbol,
  target: any,
  propertyKey?: string | symbol,
  defaultValue: T = [] as any
): T {
  const existing = Reflect.getMetadata(metaKey, target, propertyKey!);
  if (existing !== undefined) return existing;
  Reflect.defineMetadata(metaKey, defaultValue, target, propertyKey!);
  return defaultValue;
}

export function $set(
  metaKey: string | symbol,
  target: any,
  propertyKey: string | symbol | undefined,
  value: any
) {
  Reflect.defineMetadata(metaKey, value, target, propertyKey!);
  return value;
}

export function $push(
  metaKey: string | symbol,
  target: any,
  propertyKey: string | symbol | undefined,
  value: any
) {
  const arr = $getOrCreate<any[]>(metaKey, target, propertyKey!, []);
  arr.push(value);
  Reflect.defineMetadata(metaKey, arr, target, propertyKey!);
  return arr;
}

export function $merge(
  metaKey: string | symbol,
  target: any,
  propertyKey: string | symbol | undefined,
  value: any
) {
  const existing = $getOrCreate<any>(metaKey, target, propertyKey!, {});
  const merged = { ...existing, ...value };
  Reflect.defineMetadata(metaKey, merged, target, propertyKey!);
  return merged;
}

// --------------------------------
// Method helpers
// --------------------------------

export function $methods(
  target: any,
  filterFn?: (methodName: string | symbol) => boolean
): Array<string | symbol> {
  const methods = Reflect.ownKeys(target).filter(key => {
    const desc = Object.getOwnPropertyDescriptor(target, key);
    return desc && typeof desc.value === 'function' && key !== 'constructor';
  });

  return filterFn ? methods.filter(filterFn) : methods;
}

export function $method_transform(options: {
  target: any;
  propertyKey: string | symbol | undefined;
  transformFn: (name: string | symbol, originalMethod: Function) => Function;
  filterFn?: (methodName: string | symbol, fn?: Function) => boolean;
}) {
  const { target, propertyKey, transformFn, filterFn } = options;

  if (!propertyKey) {
    const methods = $methods(target);
    for (const methodName of methods) {
      $method_transform({ target, propertyKey: methodName, transformFn, filterFn });
    }
    return;
  }

  const originalMethod = target[propertyKey];

  if (filterFn && !filterFn(propertyKey, originalMethod)) {
    return originalMethod;
  }

  const transformedMethod = transformFn(propertyKey, originalMethod);
  target[propertyKey] = transformedMethod;
  return transformedMethod;
}
