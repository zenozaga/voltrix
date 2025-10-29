/**
 * Ultra-fast array operations
 * Optimized for maximum performance with minimal overhead
 */

export function fastArrayForEach<T>(array: T[], callback: (item: T, index: number) => void): void {
  for (let i = 0; i < array.length; i++) {
    callback(array[i]!, i);
  }
}

export function fastArrayFind<T>(array: T[], predicate: (item: T, index: number) => boolean): T | undefined {
  for (let i = 0; i < array.length; i++) {
    const item = array[i]!;
    if (predicate(item, i)) {
      return item;
    }
  }
  return undefined;
}

export function fastArrayFindIndex<T>(array: T[], predicate: (item: T, index: number) => boolean): number {
  for (let i = 0; i < array.length; i++) {
    const item = array[i]!;
    if (predicate(item, i)) {
      return i;
    }
  }
  return -1;
}

export function fastArrayFilter<T>(array: T[], predicate: (item: T, index: number) => boolean): T[] {
  const result: T[] = [];
  for (let i = 0; i < array.length; i++) {
    const item = array[i]!;
    if (predicate(item, i)) {
      result.push(item);
    }
  }
  return result;
}

export function fastArrayMap<T, U>(array: T[], mapper: (item: T, index: number) => U): U[] {
  const result = new Array<U>(array.length);
  for (let i = 0; i < array.length; i++) {
    result[i] = mapper(array[i]!, i);
  }
  return result;
}

export function fastArrayReduce<T, U>(array: T[], reducer: (acc: U, item: T, index: number) => U, initial: U): U {
  let acc = initial;
  for (let i = 0; i < array.length; i++) {
    acc = reducer(acc, array[i]!, i);
  }
  return acc;
}

export function fastArrayUnique<T>(array: T[]): T[] {
  const seen = new Set<T>();
  const result: T[] = [];
  
  for (let i = 0; i < array.length; i++) {
    const item = array[i]!;
    if (!seen.has(item)) {
      seen.add(item);
      result.push(item);
    }
  }
  
  return result;
}

export function fastArrayFlatten<T>(arrays: T[][]): T[] {
  const result: T[] = [];
  
  for (let i = 0; i < arrays.length; i++) {
    const arr = arrays[i];
    if (arr) {
      for (let j = 0; j < arr.length; j++) {
        result.push(arr[j]!);
      }
    }
  }
  
  return result;
}

export function fastArrayPartition<T>(array: T[], predicate: (item: T, index: number) => boolean): [T[], T[]] {
  const truthy: T[] = [];
  const falsy: T[] = [];
  
  for (let i = 0; i < array.length; i++) {
    const item = array[i]!;
    if (predicate(item, i)) {
      truthy.push(item);
    } else {
      falsy.push(item);
    }
  }
  
  return [truthy, falsy];
}