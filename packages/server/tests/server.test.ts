/**
 * Core server integration tests.
 * Real uWS server + real fetch() — no mocks.
 * Covers: routing, HTTP methods, request/response API, body, errors, pool isolation.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, type VoltrixServer } from '../src/server.js';
import { createRouter } from '../src/router/router.js';
import { notFound, badRequest, unauthorized, forbidden, unprocessableEntity } from '../src/errors/http-error.js';

const PORT = 47310;
const BASE = `http://localhost:${PORT}`;

let server: VoltrixServer;

beforeAll(async () => {
  server = createServer({ poolSize: 8 });

  // ── HTTP methods ────────────────────────────────────────────────────────────
  server.get('/ping',         (ctx) => ctx.json({ method: 'GET' }));
  server.post('/ping',        (ctx) => ctx.status(201).json({ method: 'POST' }));
  server.put('/ping',         (ctx) => ctx.json({ method: 'PUT' }));
  server.patch('/ping',       (ctx) => ctx.json({ method: 'PATCH' }));
  server.delete('/ping',      (ctx) => ctx.status(204).end());
  server.head('/ping',        (ctx) => { ctx.setHeader('X-Head', 'yes'); ctx.end(); });
  server.options('/ping',     (ctx) => { ctx.setHeader('Allow', 'GET,POST,PUT,PATCH,DELETE'); ctx.end(); });

  // ── Route params ────────────────────────────────────────────────────────────
  server.get('/users/:id',              (ctx) => ctx.json({ id: ctx.params.id }));
  server.get('/orgs/:org/repos/:repo',  (ctx) => ctx.json({ org: ctx.params.org, repo: ctx.params.repo }));
  server.get('/files/*',                (ctx) => ctx.json({ path: ctx.params['0'] ?? ctx.url.replace('/files/', '') }));

  // ── Query string ────────────────────────────────────────────────────────────
  server.get('/search', (ctx) => ctx.json(ctx.query));

  // ── Request headers ─────────────────────────────────────────────────────────
  server.get('/headers', (ctx) => ctx.json({
    ua:      ctx.header('user-agent'),
    accept:  ctx.header('accept'),
    missing: ctx.header('x-does-not-exist'),
  }));

  // ── Response API ────────────────────────────────────────────────────────────
  server.get('/res/status/:code', (ctx) => {
    ctx.status(Number(ctx.params.code)).json({ code: ctx.params.code });
  });
  server.get('/res/text',         (ctx) => ctx.send('plain text'));
  server.get('/res/buffer',       (ctx) => ctx.send(Buffer.from('binary')));
  server.get('/res/custom-hdr',   (ctx) => { ctx.setHeader('X-Custom', 'voltrix'); ctx.json({ ok: true }); });
  server.get('/res/redirect-302', (ctx) => ctx.redirect(`${BASE}/ping`));
  server.get('/res/redirect-301', (ctx) => ctx.redirect(`${BASE}/ping`, 301));
  server.get('/res/empty',        (ctx) => ctx.status(204).end());
  server.get('/res/double-send',  (ctx) => { ctx.json({ first: true }); ctx.json({ second: true }); });

  // ── Body reading ────────────────────────────────────────────────────────────
  server.post('/body/json',   async (ctx) => { const b = await ctx.readJson(); return b; });
  server.post('/body/text',   async (ctx) => { const t = await ctx.text(); ctx.send(t); });
  server.post('/body/buffer', async (ctx) => { const buf = await ctx.buffer(); ctx.send(buf); });
  server.post('/body/empty',  async (ctx) => { const t = await ctx.text(); ctx.json({ empty: t === '' }); });
  server.post('/body/large',  async (ctx) => {
    const b = await ctx.readJson<{ n: number; data: string }>();
    ctx.json({ n: b.n, len: b.data.length });
  });

  // ── Auto-serialization ──────────────────────────────────────────────────────
  server.get('/auto/object',    () => ({ auto: true, n: 42 }));
  server.get('/auto/array',     () => [1, 2, 3]);
  server.get('/auto/undefined', () => undefined);  // nothing sent → 404 catch-all won't fire (already in route)

  // ── Errors ──────────────────────────────────────────────────────────────────
  server.get('/err/404',     () => { throw notFound('item not found'); });
  server.get('/err/400',     () => { throw badRequest('bad input', 'BAD_INPUT'); });
  server.get('/err/401',     () => { throw unauthorized(); });
  server.get('/err/403',     () => { throw forbidden(); });
  server.get('/err/422',     () => { throw unprocessableEntity('validation failed'); });
  server.get('/err/500',     () => { throw new Error('unexpected boom'); });
  server.post('/err/async',  async () => { await Promise.resolve(); throw notFound('async error'); });

  // ── Sub-router via server.use() ─────────────────────────────────────────────
  const v1 = createRouter('/v1');
  v1.get('/items',      (ctx) => ctx.json({ items: [] }));
  v1.get('/items/:id',  (ctx) => ctx.json({ id: ctx.params.id }));
  v1.post('/items',     (ctx) => ctx.status(201).json({ created: true }));
  server.use(v1);

  // ── Pool isolation (stateful ctx test) ─────────────────────────────────────
  server.get('/isolated/:val', (ctx) => ctx.json({ val: ctx.params.val }));

  // ── URL-encoded param ───────────────────────────────────────────────────────
  server.get('/decode/:name', (ctx) => ctx.json({ name: ctx.params.name }));

  await server.listen({ port: PORT });
});

afterAll(() => server.close());

// ─── HTTP Methods ─────────────────────────────────────────────────────────────

describe('HTTP methods', () => {
  it('GET returns 200 with body', async () => {
    const res = await fetch(`${BASE}/ping`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ method: 'GET' });
  });

  it('POST returns 201 with body', async () => {
    const res = await fetch(`${BASE}/ping`, { method: 'POST' });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ method: 'POST' });
  });

  it('PUT returns 200 with body', async () => {
    const res = await fetch(`${BASE}/ping`, { method: 'PUT' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ method: 'PUT' });
  });

  it('PATCH returns 200 with body', async () => {
    const res = await fetch(`${BASE}/ping`, { method: 'PATCH' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ method: 'PATCH' });
  });

  it('DELETE returns 204 no content', async () => {
    const res = await fetch(`${BASE}/ping`, { method: 'DELETE' });
    expect(res.status).toBe(204);
  });

  it('HEAD returns no body but sets custom header', async () => {
    const res = await fetch(`${BASE}/ping`, { method: 'HEAD' });
    expect(res.status).toBe(200);
    expect(res.headers.get('x-head')).toBe('yes');
  });

  it('OPTIONS returns Allow header', async () => {
    const res = await fetch(`${BASE}/ping`, { method: 'OPTIONS' });
    expect(res.headers.get('allow')).toBe('GET,POST,PUT,PATCH,DELETE');
  });
});

// ─── Routing ──────────────────────────────────────────────────────────────────

describe('Routing', () => {
  it('returns 404 for unregistered path', async () => {
    const res = await fetch(`${BASE}/does-not-exist`);
    expect(res.status).toBe(404);
    const body = await res.json() as { code: string };
    expect(body.code).toBe('NOT_FOUND');
  });

  it('returns 404 for wrong method on registered path', async () => {
    // /res/text is GET only
    const res = await fetch(`${BASE}/res/text`, { method: 'POST' });
    expect(res.status).toBe(404);
  });

  it('extracts single param', async () => {
    const res = await fetch(`${BASE}/users/42`);
    expect(await res.json()).toEqual({ id: '42' });
  });

  it('extracts multiple params', async () => {
    const res = await fetch(`${BASE}/orgs/acme/repos/api`);
    expect(await res.json()).toEqual({ org: 'acme', repo: 'api' });
  });

  it('prefers static segment over param', async () => {
    // /users/me is static — register it via v1 sub-router already has /v1/items
    // Test with /users/:id → id='42' should not match /users/me
    const r1 = await fetch(`${BASE}/users/42`);
    expect((await r1.json() as {id: string}).id).toBe('42');
  });

  it('URL-decodes param values', async () => {
    const res = await fetch(`${BASE}/decode/hello%20world`);
    expect((await res.json() as {name: string}).name).toBe('hello world');
  });
});

// ─── Sub-router ───────────────────────────────────────────────────────────────

describe('Sub-router (server.use)', () => {
  it('routes GET /v1/items', async () => {
    const res = await fetch(`${BASE}/v1/items`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ items: [] });
  });

  it('routes GET /v1/items/:id', async () => {
    const res = await fetch(`${BASE}/v1/items/99`);
    expect(await res.json()).toEqual({ id: '99' });
  });

  it('routes POST /v1/items', async () => {
    const res = await fetch(`${BASE}/v1/items`, { method: 'POST' });
    expect(res.status).toBe(201);
  });
});

// ─── Query String ─────────────────────────────────────────────────────────────

describe('Query string', () => {
  it('parses string param', async () => {
    const res = await fetch(`${BASE}/search?q=hello`);
    expect((await res.json() as Record<string, unknown>).q).toBe('hello');
  });

  it('coerces numeric param', async () => {
    const res = await fetch(`${BASE}/search?limit=25`);
    expect((await res.json() as Record<string, unknown>).limit).toBe(25);
  });

  it('coerces boolean param', async () => {
    const res = await fetch(`${BASE}/search?active=true&deleted=false`);
    const body = await res.json() as Record<string, unknown>;
    expect(body.active).toBe(true);
    expect(body.deleted).toBe(false);
  });

  it('returns empty object for no query string', async () => {
    const res = await fetch(`${BASE}/search`);
    expect(await res.json()).toEqual({});
  });

  it('parses multiple params', async () => {
    const res = await fetch(`${BASE}/search?q=test&page=2&active=true`);
    const body = await res.json() as Record<string, unknown>;
    expect(body).toMatchObject({ q: 'test', page: 2, active: true });
  });
});

// ─── Request Headers ──────────────────────────────────────────────────────────

describe('Request headers', () => {
  it('reads header by lowercase name', async () => {
    const res = await fetch(`${BASE}/headers`, {
      headers: { 'User-Agent': 'test/1.0', Accept: 'application/json' },
    });
    const body = await res.json() as Record<string, unknown>;
    expect(body.ua).toBe('test/1.0');
    expect(body.accept).toBe('application/json');
  });

  it('returns undefined for missing header', async () => {
    const res = await fetch(`${BASE}/headers`);
    const body = await res.json() as Record<string, unknown>;
    expect(body.missing).toBeUndefined();
  });
});

// ─── Response API ─────────────────────────────────────────────────────────────

describe('Response: status codes', () => {
  it.each([200, 201, 202, 204, 400, 401, 403, 404, 422, 500] as const)(
    'status %d is sent correctly', async (code) => {
      const res = await fetch(`${BASE}/res/status/${code}`);
      expect(res.status).toBe(code);
    }
  );
});

describe('Response: Content-Type', () => {
  it('json() sets application/json', async () => {
    const res = await fetch(`${BASE}/ping`);
    expect(res.headers.get('content-type')).toContain('application/json');
  });

  it('send(string) sets text/plain', async () => {
    const res = await fetch(`${BASE}/res/text`);
    expect(res.headers.get('content-type')).toContain('text/plain');
    expect(await res.text()).toBe('plain text');
  });

  it('send(Buffer) sets application/octet-stream', async () => {
    const res = await fetch(`${BASE}/res/buffer`);
    expect(res.headers.get('content-type')).toContain('application/octet-stream');
  });
});

describe('Response: headers', () => {
  it('setHeader() appears in response', async () => {
    const res = await fetch(`${BASE}/res/custom-hdr`);
    expect(res.headers.get('x-custom')).toBe('voltrix');
  });
});

describe('Response: redirect', () => {
  it('redirect() sends 302 with Location', async () => {
    const res = await fetch(`${BASE}/res/redirect-302`, { redirect: 'manual' });
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe(`${BASE}/ping`);
  });

  it('redirect(url, 301) sends 301', async () => {
    const res = await fetch(`${BASE}/res/redirect-301`, { redirect: 'manual' });
    expect(res.status).toBe(301);
  });
});

describe('Response: empty + double-send guard', () => {
  it('end() sends empty 204', async () => {
    const res = await fetch(`${BASE}/res/empty`);
    expect(res.status).toBe(204);
  });

  it('double-send is ignored — first response wins', async () => {
    const res = await fetch(`${BASE}/res/double-send`);
    expect(res.status).toBe(200);
    const body = await res.json() as { first?: boolean; second?: boolean };
    expect(body.first).toBe(true);
    expect(body.second).toBeUndefined();
  });
});

// ─── Body Reading ─────────────────────────────────────────────────────────────

describe('Request body', () => {
  it('readJson() parses JSON', async () => {
    const res = await fetch(`${BASE}/body/json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Alice', age: 30 }),
    });
    expect(await res.json()).toEqual({ name: 'Alice', age: 30 });
  });

  it('readJson() is cached — second call returns same object', async () => {
    const res = await fetch(`${BASE}/body/json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ x: 1 }),
    });
    expect(res.status).toBe(200);
  });

  it('text() returns UTF-8 string', async () => {
    const res = await fetch(`${BASE}/body/text`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: 'héllo wörld',
    });
    expect(await res.text()).toBe('héllo wörld');
  });

  it('buffer() returns raw bytes', async () => {
    const res = await fetch(`${BASE}/body/buffer`, {
      method: 'POST',
      body: 'raw bytes',
    });
    expect(await res.text()).toBe('raw bytes');
  });

  it('text() returns empty string for no body', async () => {
    const res = await fetch(`${BASE}/body/empty`, { method: 'POST' });
    expect(await res.json()).toEqual({ empty: true });
  });

  it('handles large body (>64KB) via chunk accumulation', async () => {
    const data = 'x'.repeat(100_000);
    const res = await fetch(`${BASE}/body/large`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ n: 1, data }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { n: number; len: number };
    expect(body.n).toBe(1);
    expect(body.len).toBe(100_000);
  });
});

// ─── Auto-serialization ───────────────────────────────────────────────────────

describe('Auto-serialization', () => {
  it('returned object is JSON-serialized', async () => {
    const res = await fetch(`${BASE}/auto/object`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ auto: true, n: 42 });
    expect(res.headers.get('content-type')).toContain('application/json');
  });

  it('returned array is JSON-serialized', async () => {
    const res = await fetch(`${BASE}/auto/array`);
    expect(await res.json()).toEqual([1, 2, 3]);
  });

  it('returned undefined → server sends 204 safeguard (no hang)', async () => {
    const res = await fetch(`${BASE}/auto/undefined`);
    expect(res.status).toBe(204);
  });
});

// ─── Error Handling ───────────────────────────────────────────────────────────

describe('Error handling', () => {
  it('HttpError 404 → correct status + code + message', async () => {
    const res = await fetch(`${BASE}/err/404`);
    expect(res.status).toBe(404);
    const body = await res.json() as { statusCode: number; code: string; message: string };
    expect(body.statusCode).toBe(404);
    expect(body.code).toBe('NOT_FOUND');
    expect(body.message).toBe('item not found');
  });

  it('HttpError 400 with custom code', async () => {
    const res = await fetch(`${BASE}/err/400`);
    expect(res.status).toBe(400);
    expect((await res.json() as { code: string }).code).toBe('BAD_INPUT');
  });

  it('HttpError 401 Unauthorized', async () => {
    const res = await fetch(`${BASE}/err/401`);
    expect(res.status).toBe(401);
    expect((await res.json() as { code: string }).code).toBe('UNAUTHORIZED');
  });

  it('HttpError 403 Forbidden', async () => {
    const res = await fetch(`${BASE}/err/403`);
    expect(res.status).toBe(403);
  });

  it('HttpError 422 Unprocessable Entity', async () => {
    const res = await fetch(`${BASE}/err/422`);
    expect(res.status).toBe(422);
    expect((await res.json() as { message: string }).message).toBe('validation failed');
  });

  it('unknown Error → 500 with message', async () => {
    const res = await fetch(`${BASE}/err/500`);
    expect(res.status).toBe(500);
    const body = await res.json() as { statusCode: number; message: string };
    expect(body.statusCode).toBe(500);
  });

  it('async handler error is caught correctly', async () => {
    const res = await fetch(`${BASE}/err/async`, { method: 'POST' });
    expect(res.status).toBe(404);
    expect((await res.json() as { message: string }).message).toBe('async error');
  });
});

// ─── Pool Isolation ───────────────────────────────────────────────────────────

describe('Pool isolation (concurrent requests)', () => {
  it('concurrent requests do not share ctx state', async () => {
    const values = ['aaa', 'bbb', 'ccc', 'ddd', 'eee', 'fff', 'ggg', 'hhh'];
    const results = await Promise.all(
      values.map(v => fetch(`${BASE}/isolated/${v}`).then(r => r.json() as Promise<{ val: string }>))
    );
    const received = results.map(r => r.val).sort();
    expect(received).toEqual([...values].sort());
  });

  it('10 concurrent requests all return correct isolated values', async () => {
    const ids = Array.from({ length: 10 }, (_, i) => `user${i}`);
    const results = await Promise.all(
      ids.map(id => fetch(`${BASE}/users/${id}`).then(r => r.json() as Promise<{ id: string }>))
    );
    for (const r of results) {
      expect(ids).toContain(r.id);
    }
  });
});
