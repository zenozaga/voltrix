/**
 * Plugin system integration tests — real HTTP server.
 * Covers: register(), decorateCtx(), plugin hooks, serializer compiler override,
 * duplicate key conflict, async plugins, and option passing.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, type VoltrixServer } from '../src/server.js';
import type { VoltrixPlugin } from '../src/plugins/plugin-types.js';
import type { Ctx } from '../src/context/context.js';

const PORT = 47312;
const BASE = `http://localhost:${PORT}`;

let server: VoltrixServer;

beforeAll(async () => {
  server = createServer();

  // ── Plugin 1: sync — decorates ctx with a string value ─────────────────────
  const requestIdPlugin: VoltrixPlugin<{ prefix: string }> = {
    name: 'request-id',
    register(api, opts) {
      api.decorateCtx('requestId', null);
      api.addHook('onRequest', (ctx: Ctx & { requestId: string }) => {
        ctx.requestId = `${opts.prefix}-${Math.random().toString(36).slice(2, 8)}`;
      });
    },
  };
  await server.register(requestIdPlugin, { prefix: 'req' });

  // ── Plugin 2: async — decorates ctx with a counter ──────────────────────────
  const counterPlugin: VoltrixPlugin<void> = {
    name: 'counter',
    async register(api) {
      await Promise.resolve(); // simulates async init (e.g. DB connection)
      api.decorateCtx('hitCount', 0);
      api.addHook('onRequest', (ctx: Ctx & { hitCount: number }) => {
        ctx.hitCount = (ctx.hitCount ?? 0) + 1;
      });
    },
  };
  await server.register(counterPlugin);

  // ── Plugin 3: custom serializer compiler ────────────────────────────────────
  let serializerUsed = false;
  const customSerializerPlugin: VoltrixPlugin<void> = {
    name: 'custom-serializer',
    register(api) {
      api.setSerializerCompiler({
        compile(_schema) {
          return (value: unknown) => {
            serializerUsed = true;
            return JSON.stringify(value);
          };
        },
      });
    },
  };
  await server.register(customSerializerPlugin);

  // ── Routes ──────────────────────────────────────────────────────────────────

  // Verify decorateCtx properties are present and set
  server.get('/plugin/request-id', (ctx: Ctx & { requestId: string }) => {
    ctx.json({ hasId: typeof ctx.requestId === 'string' && ctx.requestId.startsWith('req-') });
  });

  server.get('/plugin/hit-count', (ctx: Ctx & { hitCount: number }) => {
    ctx.json({ hitCount: ctx.hitCount });
  });

  // Route with a response schema — return value triggers auto-serialization via
  // the compiled serializer (ctx.json() direct-call bypasses it)
  server
    .get('/plugin/serializer', () => ({ ok: true }))
    .serialize({ type: 'object' });

  // Expose whether custom serializer was invoked
  server.get('/plugin/serializer-used', (ctx) => {
    ctx.json({ used: serializerUsed });
  });

  // ── Test duplicate decorateCtx conflict ─────────────────────────────────────
  // We test this via a second isolated server (not beforeAll server) to avoid
  // contaminating the main server state.

  await server.listen({ port: PORT });
});

afterAll(() => server.close());

// ─── Sync plugin ──────────────────────────────────────────────────────────────

describe('Sync plugin', () => {
  it('decorateCtx adds property accessible in handler', async () => {
    const res = await fetch(`${BASE}/plugin/request-id`);
    expect(res.status).toBe(200);
    const body = await res.json() as { hasId: boolean };
    expect(body.hasId).toBe(true);
  });

  it('plugin-added onRequest hook runs on every request', async () => {
    // Two sequential requests — both should have requestId set
    const [r1, r2] = await Promise.all([
      fetch(`${BASE}/plugin/request-id`).then(r => r.json() as Promise<{ hasId: boolean }>),
      fetch(`${BASE}/plugin/request-id`).then(r => r.json() as Promise<{ hasId: boolean }>),
    ]);
    expect(r1.hasId).toBe(true);
    expect(r2.hasId).toBe(true);
  });
});

// ─── Async plugin ─────────────────────────────────────────────────────────────

describe('Async plugin', () => {
  it('async register() is awaited before server starts — decorated prop reset per request', async () => {
    // Pool resets hitCount to 0 on each acquire, then onRequest sets it to 1.
    // Every request should see exactly 1 regardless of pool reuse.
    const [r1, r2, r3] = await Promise.all([
      fetch(`${BASE}/plugin/hit-count`).then(r => r.json() as Promise<{ hitCount: number }>),
      fetch(`${BASE}/plugin/hit-count`).then(r => r.json() as Promise<{ hitCount: number }>),
      fetch(`${BASE}/plugin/hit-count`).then(r => r.json() as Promise<{ hitCount: number }>),
    ]);
    expect(r1.hitCount).toBe(1);
    expect(r2.hitCount).toBe(1);
    expect(r3.hitCount).toBe(1);
  });
});

// ─── Custom serializer compiler ───────────────────────────────────────────────

describe('Serializer compiler plugin', () => {
  it('custom compiler is used for routes with a schema', async () => {
    await fetch(`${BASE}/plugin/serializer`);
    const res = await fetch(`${BASE}/plugin/serializer-used`);
    const body = await res.json() as { used: boolean };
    expect(body.used).toBe(true);
  });
});

// ─── Duplicate decorateCtx conflict ──────────────────────────────────────────

describe('decorateCtx conflict', () => {
  it('throws when two plugins register the same key', async () => {
    const isolated = createServer();

    const p1: VoltrixPlugin<void> = {
      name: 'p1',
      register(api) { api.decorateCtx('shared', null); },
    };
    const p2: VoltrixPlugin<void> = {
      name: 'p2',
      register(api) { api.decorateCtx('shared', null); },
    };

    await isolated.register(p1);
    await expect(isolated.register(p2)).rejects.toThrow('shared');
  });
});

// ─── Plugin option passing ────────────────────────────────────────────────────

describe('Plugin options', () => {
  it('options are passed correctly to register()', async () => {
    const received: { prefix?: string } = {};
    const optPlugin: VoltrixPlugin<{ prefix: string }> = {
      name: 'opt-test',
      register(_api, opts) { received.prefix = opts.prefix; },
    };

    const isolated = createServer();
    await isolated.register(optPlugin, { prefix: 'test-prefix' });

    expect(received.prefix).toBe('test-prefix');
  });

  it('register() without options works for plugins with void options', async () => {
    let called = false;
    const noOptsPlugin: VoltrixPlugin<void> = {
      name: 'no-opts',
      register() { called = true; },
    };

    const isolated = createServer();
    await isolated.register(noOptsPlugin);
    expect(called).toBe(true);
  });
});
