import type { HttpRequest, HttpResponse } from 'uWebSockets.js';
import { Ctx } from './context.js';

/**
 * Object pool for Ctx instances.
 *
 * Avoids GC pressure on high-throughput routes by reusing Ctx objects.
 * Each request acquires a Ctx, uses it, then releases it back to the pool.
 *
 * Pool growth: if the pool is empty under load, new instances are allocated
 * on-demand. The pool never shrinks below its initial size.
 *
 * Usage:
 * ```ts
 * const pool = new CtxPool(64);
 * const ctx  = pool.acquire(res, req, params);
 * try {
 *   await handler(ctx);
 * } finally {
 *   pool.release(ctx);
 * }
 * ```
 */
export class CtxPool {
  private readonly pool: Ctx[] = [];
  /** Plugin-decorated property keys and their default values — reset on every acquire. */
  private readonly _decoratedResets: Array<[string, unknown]> = [];

  constructor(initialSize = 64) {
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(new Ctx());
    }
  }

  /**
   * Register a plugin-decorated property for reset on every acquire.
   * Called once per property at startup via `server.decorateCtx()`.
   */
  addDecoratedReset(key: string, defaultValue: unknown): void {
    this._decoratedResets.push([key, defaultValue]);
  }

  /**
   * Acquire a Ctx from the pool and initialize it for the current request.
   * Resets all plugin-decorated properties to their registered defaults.
   * Falls back to allocating a new instance if the pool is empty.
   */
  acquire<P extends Record<string, string>>(
    res: HttpResponse,
    req: HttpRequest,
    params: P,
    method: string,
    url: string,
  ): Ctx<P> {
    const ctx = (this.pool.pop() ?? new Ctx()) as Ctx<P>;
    ctx.initialize(res, req, params, method, url);
    // Reset plugin-decorated properties so pooled instances don't bleed state
    const resets = this._decoratedResets;
    for (let i = 0; i < resets.length; i++) {
      (ctx as unknown as Record<string, unknown>)[resets[i][0]] = resets[i][1];
    }
    return ctx;
  }

  /**
   * Return a Ctx to the pool after the response has been sent.
   * Calls `release()` to clear all request-specific references.
   */
  release(ctx: Ctx): void {
    ctx.release();
    this.pool.push(ctx);
  }

  /** Current number of available instances in the pool. */
  get size(): number { return this.pool.length; }
}
