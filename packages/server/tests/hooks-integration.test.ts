/**
 * Hook lifecycle integration tests — real HTTP server.
 * Verifies execution order, short-circuit, error interception, and scope
 * (global vs route-local hooks).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, type VoltrixServer } from '../src/server.js';
import { forbidden } from '../src/errors/http-error.js';

const PORT = 47311;
const BASE = `http://localhost:${PORT}`;

let server: VoltrixServer;

beforeAll(async () => {
  server = createServer();

  // ── Execution order log ─────────────────────────────────────────────────────
  // Accumulate steps in a ctx-scoped array (own property, not response headers).
  type LogCtx = typeof Object.prototype & { _log?: string[] };

  server.addHook('onRequest', (ctx) => {
    (ctx as unknown as LogCtx)._log = [];
    (ctx as unknown as LogCtx)._log!.push('G-onRequest');
  });

  server.addHook('preHandler', (ctx) => {
    (ctx as unknown as LogCtx)._log!.push('G-preHandler');
  });

  // ── onRequest: global fires before handler ──────────────────────────────────
  server.get('/hooks/order', (ctx) => {
    ctx.json({ log: (ctx as unknown as LogCtx)._log });
  });

  // ── Route-local hooks fire after global ─────────────────────────────────────
  server
    .get('/hooks/local', (ctx) => {
      ctx.json({ log: (ctx as unknown as LogCtx)._log });
    })
    .onRequest((ctx) => {
      (ctx as unknown as LogCtx)._log!.push('L-onRequest');
    })
    .preHandler((ctx) => {
      (ctx as unknown as LogCtx)._log!.push('L-preHandler');
    });

  // ── onRequest short-circuit via throw ───────────────────────────────────────
  server
    .get('/hooks/blocked', (ctx) => {
      // Should never reach here
      ctx.json({ reached: true });
    })
    .onRequest(() => {
      throw forbidden('access denied');
    });

  // ── onRequest short-circuit via ctx.send() ──────────────────────────────────
  server
    .get('/hooks/early-send', (ctx) => {
      ctx.json({ reached: true }); // should not run
    })
    .onRequest((ctx) => {
      ctx.status(200).json({ early: true });
      // ctx.sent = true → handler skipped
    });

  // ── preHandler short-circuit ────────────────────────────────────────────────
  server
    .get('/hooks/prehandler-block', (ctx) => {
      ctx.json({ reached: true });
    })
    .preHandler(() => {
      throw forbidden('pre-handler denied');
    });

  // ── onError global hook ─────────────────────────────────────────────────────
  server.addHook('onError', (ctx, err) => {
    const msg = err instanceof Error ? err.message : 'unknown';
    ctx.status(418).json({ intercepted: true, message: msg });
  });

  // This route's error should be intercepted by the onError hook above
  server.get('/hooks/error-intercepted', () => {
    throw new Error('intercepted error');
  });

  // ── async hooks ─────────────────────────────────────────────────────────────
  server
    .get('/hooks/async', async (ctx) => {
      ctx.json({ done: true });
    })
    .onRequest(async (ctx) => {
      await Promise.resolve();
      ctx.setHeader('X-Async', 'true');
    });

  // ── Multiple global onError hooks — all run until one sends ─────────────────
  // Second server to avoid state pollution — but we can test on this one since
  // onError was already added. For multi-hook onError we use a dedicated route.
  server.get('/hooks/multi-error', () => {
    throw new Error('multi');
  });
  // onError hook above already handles this — should respond with 418

  // ── onResponse fires after handler ─────────────────────────────────────────
  // Side-effect: increment a counter accessible via /hooks/response-count
  let responseCount = 0;
  server.addHook('onResponse', () => { responseCount++; });
  server.get('/hooks/response-count', (ctx) => ctx.json({ count: responseCount }));

  await server.listen({ port: PORT });
});

afterAll(() => server.close());

// ─── Execution order ──────────────────────────────────────────────────────────

describe('Hook execution order', () => {
  it('global onRequest fires before handler', async () => {
    const res = await fetch(`${BASE}/hooks/order`);
    const body = await res.json() as { log: string[] };
    expect(body.log).toContain('G-onRequest');
  });

  it('global preHandler fires before handler', async () => {
    const res = await fetch(`${BASE}/hooks/order`);
    const body = await res.json() as { log: string[] };
    expect(body.log).toContain('G-preHandler');
  });

  it('global hooks run before route-local hooks', async () => {
    const res = await fetch(`${BASE}/hooks/local`);
    const body = await res.json() as { log: string[] };
    const log = body.log;
    expect(log.indexOf('G-onRequest')).toBeLessThan(log.indexOf('L-onRequest'));
    expect(log.indexOf('G-preHandler')).toBeLessThan(log.indexOf('L-preHandler'));
  });

  it('full order: G-onRequest → L-onRequest → G-preHandler → L-preHandler → handler', async () => {
    const res = await fetch(`${BASE}/hooks/local`);
    const body = await res.json() as { log: string[] };
    expect(body.log).toEqual(['G-onRequest', 'L-onRequest', 'G-preHandler', 'L-preHandler']);
  });
});

// ─── Short-circuit ────────────────────────────────────────────────────────────

describe('Hook short-circuit', () => {
  it('onRequest throw prevents handler — returns HttpError status', async () => {
    // onError hook intercepts — returns 418
    const res = await fetch(`${BASE}/hooks/blocked`);
    expect(res.status).toBe(418);
    const body = await res.json() as { intercepted: boolean };
    expect(body.intercepted).toBe(true);
  });

  it('onRequest ctx.send() prevents handler from running', async () => {
    const res = await fetch(`${BASE}/hooks/early-send`);
    const body = await res.json() as { early?: boolean; reached?: boolean };
    expect(body.early).toBe(true);
    expect(body.reached).toBeUndefined();
  });

  it('preHandler throw prevents handler', async () => {
    // onError intercepts
    const res = await fetch(`${BASE}/hooks/prehandler-block`);
    expect(res.status).toBe(418);
  });
});

// ─── onError hook ─────────────────────────────────────────────────────────────

describe('onError hook', () => {
  it('intercepts handler errors and sends custom response', async () => {
    const res = await fetch(`${BASE}/hooks/error-intercepted`);
    expect(res.status).toBe(418);
    const body = await res.json() as { intercepted: boolean; message: string };
    expect(body.intercepted).toBe(true);
    expect(body.message).toBe('intercepted error');
  });

  it('onError hook receives the original error', async () => {
    const res = await fetch(`${BASE}/hooks/multi-error`);
    expect(res.status).toBe(418);
    const body = await res.json() as { message: string };
    expect(body.message).toBe('multi');
  });
});

// ─── Async hooks ──────────────────────────────────────────────────────────────

describe('Async hooks', () => {
  it('async onRequest hook is awaited before handler', async () => {
    const res = await fetch(`${BASE}/hooks/async`);
    expect(res.status).toBe(200);
    expect(res.headers.get('x-async')).toBe('true');
  });
});

// ─── onResponse ───────────────────────────────────────────────────────────────

describe('onResponse hook', () => {
  it('fires after every successful response', async () => {
    // Hit /hooks/order a few times, then check the counter
    // Counter starts at some value — we check it increments
    const before = await fetch(`${BASE}/hooks/response-count`).then(r => r.json() as Promise<{ count: number }>);
    await fetch(`${BASE}/hooks/order`);
    await fetch(`${BASE}/hooks/order`);
    const after = await fetch(`${BASE}/hooks/response-count`).then(r => r.json() as Promise<{ count: number }>);
    expect(after.count).toBeGreaterThan(before.count);
  });
});
