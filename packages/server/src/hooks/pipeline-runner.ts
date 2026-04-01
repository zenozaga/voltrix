import { HookClass } from './hook-types.js';
import { classifyHooks } from './hook-manager.js';
import type { Ctx } from '../context/context.js';

type CtxHook = (ctx: Ctx) => void | Promise<void>;

/**
 * A compiled pipeline — the public Promise-based runner.
 * Created once per route at startup.
 */
export type CompiledPipeline = (ctx: Ctx) => Promise<void>;

/**
 * Internal fast pipeline used by the server hot path.
 * Returns void for fully sync routes to avoid Promise churn.
 */
export type InlinePipeline = (ctx: Ctx) => void | Promise<void>;

/** The resolved empty pipeline — single shared Promise.resolve(). */
const EMPTY_PIPELINE: CompiledPipeline = (_ctx: Ctx) => Promise.resolve();
/** Shared no-op for sync fast path. */
const EMPTY_INLINE_PIPELINE: InlinePipeline = (_ctx: Ctx) => {};

/**
 * Compiles a hook array into the optimal Promise-based pipeline runner.
 * Kept for the public API and tests.
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

/**
 * Compiles a hook array into the inline runner used by the server hot path.
 * Sync pipelines return immediately; async pipelines still return a Promise.
 */
export function compileInlinePipeline(hooks: CtxHook[]): InlinePipeline {
  const cls = classifyHooks(hooks as Function[]);

  switch (cls) {
    case HookClass.EMPTY:
      return EMPTY_INLINE_PIPELINE;

    case HookClass.SYNC:
      return compileInlineSyncPipeline(hooks);

    case HookClass.MIXED:
      return compileInlineMixedPipeline(hooks);

    case HookClass.ASYNC:
      return compileInlineAsyncPipeline(hooks);
  }
}

// ─── Public Promise-based implementations ───────────────────────────────────

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

function compileMixedPipeline(hooks: CtxHook[]): CompiledPipeline {
  const len = hooks.length;
  return async function runMixed(ctx: Ctx): Promise<void> {
    for (let i = 0; i < len; i++) {
      const r = hooks[i](ctx);
      if (isThenable(r)) {
        await r;
      }
    }
  };
}

function compileAsyncPipeline(hooks: CtxHook[]): CompiledPipeline {
  const len = hooks.length;
  return async function runAsync(ctx: Ctx): Promise<void> {
    for (let i = 0; i < len; i++) {
      await hooks[i](ctx);
    }
  };
}

// ─── Internal inline implementations ────────────────────────────────────────

function compileInlineSyncPipeline(hooks: CtxHook[]): InlinePipeline {
  const len = hooks.length;
  return function runInlineSync(ctx: Ctx): void {
    for (let i = 0; i < len; i++) {
      (hooks[i] as (ctx: Ctx) => void)(ctx);
    }
  };
}

function compileInlineMixedPipeline(hooks: CtxHook[]): InlinePipeline {
  const len = hooks.length;
  return function runInlineMixed(ctx: Ctx): void | Promise<void> {
    for (let i = 0; i < len; i++) {
      const r = hooks[i](ctx);
      if (isThenable(r)) {
        return resumeInlineMixedPipeline(hooks, ctx, i + 1, r, len);
      }
    }
  };
}

function compileInlineAsyncPipeline(hooks: CtxHook[]): InlinePipeline {
  const len = hooks.length;
  return async function runInlineAsync(ctx: Ctx): Promise<void> {
    for (let i = 0; i < len; i++) {
      await hooks[i](ctx);
    }
  };
}

function resumeInlineMixedPipeline(
  hooks: CtxHook[],
  ctx: Ctx,
  startIdx: number,
  pending: Promise<void>,
  len: number,
): Promise<void> {
  return pending.then(() => {
    for (let i = startIdx; i < len; i++) {
      const r = hooks[i](ctx);
      if (isThenable(r)) {
        return resumeInlineMixedPipeline(hooks, ctx, i + 1, r, len);
      }
    }
  });
}

function isThenable(value: void | Promise<void>): value is Promise<void> {
  return value !== null && value !== undefined && typeof (value as Promise<void>).then === 'function';
}
