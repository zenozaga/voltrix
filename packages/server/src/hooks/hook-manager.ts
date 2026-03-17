import { HookClass } from './hook-types.js';

/** The AsyncFunction constructor — reliable async detection without regex. */
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor as FunctionConstructor;

/**
 * Returns true if the function is declared async.
 * Uses prototype check — O(1), no string parsing.
 */
export function isAsyncFunction(fn: Function): boolean {
  return fn instanceof AsyncFunction;
}

/**
 * Classifies an array of hooks into a HookClass.
 * Called once per route at startup — zero cost in hot path.
 */
export function classifyHooks(hooks: Function[]): HookClass {
  if (hooks.length === 0) return HookClass.EMPTY;

  let hasAsync = false;
  let hasSync  = false;

  for (const hook of hooks) {
    if (isAsyncFunction(hook)) {
      hasAsync = true;
    } else {
      hasSync = true;
    }
    // Short-circuit: if we have both, it's MIXED
    if (hasAsync && hasSync) return HookClass.MIXED;
  }

  return hasAsync ? HookClass.ASYNC : HookClass.SYNC;
}

/**
 * Merges global hooks with route-local hooks.
 * Global hooks run first; route-local hooks run after.
 * Returns a new flat array — no mutation of either input.
 */
export function mergeHooks<T extends Function>(global: T[], local: T[]): T[] {
  if (global.length === 0) return local.length === 0 ? [] : local.slice();
  if (local.length === 0) return global.slice();
  return global.concat(local);
}
