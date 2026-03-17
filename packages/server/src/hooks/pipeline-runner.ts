import { HookClass } from './hook-types.js';
import { classifyHooks } from './hook-manager.js';
import type { Ctx } from '../context/context.js';

type CtxHook = (ctx: Ctx) => void | Promise<void>;

/**
 * A compiled pipeline — the optimal runner for a fixed set of hooks.
 * Created once per route at startup.
 */
export type CompiledPipeline = (ctx: Ctx) => Promise<void>;

/** The resolved empty pipeline — single shared Promise.resolve(). */
const EMPTY_PIPELINE: CompiledPipeline = (_ctx: Ctx) => Promise.resolve();

/**
 * Compiles a hook array into the optimal pipeline runner.
 *
 * Performance tiers (5 hooks, 500k iterations from benchmark):
 *   EMPTY:  single Promise.resolve()       — ~19M ops/s
 *   SYNC:   tight loop + Promise.resolve() — ~19M ops/s
 *   MIXED:  thenable check per hook        — ~17M ops/s
 *   ASYNC:  await each hook                — ~4M ops/s
 *
 * @param hooks - Array of hooks to compile. Must be stable (not mutated after compile).
 */
export function compilePipeline(hooks: CtxHook[]): CompiledPipeline {
  const cls = classifyHooks(hooks as Function[]);

  switch (cls) {
    case HookClass.EMPTY:
      return EMPTY_PIPELINE;

    case HookClass.SYNC:
      return compileSyncPipeline(hooks);

    case HookClass.MIXED:
      return compileMixedPipeline(hooks);

    case HookClass.ASYNC:
      return compileAsyncPipeline(hooks);
  }
}

// ─── Tier implementations ─────────────────────────────────────────────────────

/**
 * SYNC tier: tight loop, zero Promise allocation per hook.
 * Returns a single Promise.resolve() at the end to satisfy the async boundary.
 */
function compileSyncPipeline(hooks: CtxHook[]): CompiledPipeline {
  const len = hooks.length;
  return function runSync(ctx: Ctx): Promise<void> {
    try {
      for (let i = 0; i < len; i++) {
        (hooks[i] as (ctx: Ctx) => void)(ctx);
      }
      return Promise.resolve();
    } catch (err) {
      return Promise.reject(err as Error);
    }
  };
}

/**
 * MIXED tier: thenable check — only await when the hook actually returns a Promise.
 * Sync hooks pay zero async overhead; async hooks pay one microtask tick.
 * Proven at 17M ops/s for all-sync workloads in the async-patterns benchmark.
 */
function compileMixedPipeline(hooks: CtxHook[]): CompiledPipeline {
  const len = hooks.length;
  return async function runMixed(ctx: Ctx): Promise<void> {
    for (let i = 0; i < len; i++) {
      const r = hooks[i](ctx);
      if (r !== null && r !== undefined && typeof (r as Promise<void>).then === 'function') {
        await r;
      }
    }
  };
}

/**
 * ASYNC tier: await each hook — honest cost for fully async pipelines.
 * Use when all hooks are declared async (e.g. auth, rate limit, DB lookups).
 */
function compileAsyncPipeline(hooks: CtxHook[]): CompiledPipeline {
  const len = hooks.length;
  return async function runAsync(ctx: Ctx): Promise<void> {
    for (let i = 0; i < len; i++) {
      await hooks[i](ctx);
    }
  };
}
