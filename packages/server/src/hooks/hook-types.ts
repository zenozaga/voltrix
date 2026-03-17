import type { Ctx } from '../context/context.js';
import type { BodyInput } from '../common/normalize.js';

// ─── Hook signatures ──────────────────────────────────────────────────────────

/**
 * Runs on every incoming request — before routing and before any handler.
 * Ideal for: logging, rate limiting, authentication.
 * Can throw an HttpError to short-circuit the request.
 */
export type OnRequestHook = (ctx: Ctx) => void | Promise<void>;

/**
 * Runs after routing but before the route handler executes.
 * Receives the matched ctx (params are populated).
 * Ideal for: per-route authorization, validation side-effects.
 */
export type PreHandlerHook = (ctx: Ctx) => void | Promise<void>;

/**
 * Runs after the route handler has returned, before the response is sent.
 * Can transform the payload that will be written to the response.
 * Return the (possibly modified) payload, or undefined to keep the original.
 */
export type OnSendHook = (ctx: Ctx, payload: BodyInput) => BodyInput | undefined | Promise<BodyInput | undefined>;

/**
 * Runs after the response has been fully sent.
 * Ideal for: cleanup, metrics, releasing resources.
 * Errors thrown here are silently swallowed — use for fire-and-forget work.
 */
export type OnResponseHook = (ctx: Ctx) => void | Promise<void>;

/**
 * Runs when any hook or handler throws.
 * Must send a response or re-throw to propagate.
 */
export type OnErrorHook = (ctx: Ctx, err: unknown) => void | Promise<void>;

// ─── Hook set ─────────────────────────────────────────────────────────────────

/** All lifecycle hook arrays for a single scope (global or per-route). */
export interface HookSet {
  onRequest:    OnRequestHook[];
  preHandler:   PreHandlerHook[];
  onSend:       OnSendHook[];
  onResponse:   OnResponseHook[];
  onError:      OnErrorHook[];
}

/** Creates an empty HookSet — used as baseline for merging. */
export function emptyHookSet(): HookSet {
  return {
    onRequest:  [],
    preHandler: [],
    onSend:     [],
    onResponse: [],
    onError:    [],
  };
}

// ─── Classification ───────────────────────────────────────────────────────────

/**
 * Hook classification used to select the optimal pipeline runner at startup.
 *
 * - EMPTY:  No hooks — skip the pipeline entirely.
 * - SYNC:   All hooks are synchronous — tight loop, single Promise.resolve() at end.
 * - MIXED:  Mix of sync and async — thenable check per hook (17M ops/s).
 * - ASYNC:  All hooks are async — await each (4M ops/s, honest cost).
 */
export enum HookClass {
  EMPTY = 0,
  SYNC  = 1,
  MIXED = 2,
  ASYNC = 3,
}
