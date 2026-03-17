/**
 * ctx.locals integration tests — real HTTP server.
 * Verifies: hook→handler data passing, reset per request (no pool bleed),
 * nested objects, and overwrite semantics.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, type VoltrixServer } from '../src/server.js';

const PORT = 47313;
const BASE = `http://localhost:${PORT}`;

let server: VoltrixServer;

beforeAll(async () => {
  server = createServer();

  // ── Seed locals in onRequest hook ────────────────────────────────────────
  server.addHook('onRequest', (ctx) => {
    ctx.locals.requestId = `id-${Date.now()}`;
    ctx.locals.count     = 0;
  });

  server.addHook('preHandler', (ctx) => {
    (ctx.locals.count as number)++;
  });

  // ── Route: read locals set by hooks ──────────────────────────────────────
  server.get('/locals/basic', (ctx) => {
    ctx.json({
      hasId:  typeof ctx.locals.requestId === 'string',
      count:  ctx.locals.count,
    });
  });

  // ── Route: overwrite in handler ───────────────────────────────────────────
  server.get('/locals/overwrite', (ctx) => {
    ctx.locals.count = 99;
    ctx.json({ count: ctx.locals.count });
  });

  // ── Route: nested object ──────────────────────────────────────────────────
  server.addHook('onRequest', (ctx) => {
    ctx.locals.user = { id: 42, role: 'admin' };
  });
  server.get('/locals/user', (ctx) => {
    const user = ctx.locals.user as { id: number; role: string };
    ctx.json({ id: user.id, role: user.role });
  });

  // ── Route: locals are isolated per request (no pool bleed) ───────────────
  // Each request gets a fresh count starting at 0 from onRequest, then +1 from preHandler.
  // Concurrent requests should all see count=1.
  server.get('/locals/isolated', (ctx) => {
    ctx.json({ count: ctx.locals.count });
  });

  await server.listen({ port: PORT });
});

afterAll(() => server.close());

// ─── Basic data passing ───────────────────────────────────────────────────────

describe('ctx.locals — hook to handler', () => {
  it('onRequest hook value is readable in handler', async () => {
    const res  = await fetch(`${BASE}/locals/basic`);
    const body = await res.json() as { hasId: boolean; count: number };
    expect(body.hasId).toBe(true);
  });

  it('preHandler hook increments count set by onRequest', async () => {
    const res  = await fetch(`${BASE}/locals/basic`);
    const body = await res.json() as { hasId: boolean; count: number };
    expect(body.count).toBe(1);
  });

  it('handler can overwrite locals values', async () => {
    const res  = await fetch(`${BASE}/locals/overwrite`);
    const body = await res.json() as { count: number };
    expect(body.count).toBe(99);
  });

  it('nested objects round-trip correctly', async () => {
    const res  = await fetch(`${BASE}/locals/user`);
    const body = await res.json() as { id: number; role: string };
    expect(body.id).toBe(42);
    expect(body.role).toBe('admin');
  });
});

// ─── Pool isolation ───────────────────────────────────────────────────────────

describe('ctx.locals — reset per request (no pool bleed)', () => {
  it('concurrent requests each see count=1 — no cross-request state', async () => {
    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        fetch(`${BASE}/locals/isolated`).then(r => r.json() as Promise<{ count: number }>)
      )
    );
    for (const body of results) {
      expect(body.count).toBe(1);
    }
  });

  it('sequential requests do not accumulate locals.count', async () => {
    for (let i = 0; i < 5; i++) {
      const res  = await fetch(`${BASE}/locals/isolated`);
      const body = await res.json() as { count: number };
      expect(body.count).toBe(1); // always 1, never 2+
    }
  });
});
