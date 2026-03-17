/**
 * RouteRegistry + RouteBuilder unit tests.
 * No server needed — tests the metadata layer in isolation.
 * This is the foundation for OpenAPI generators, adapters, and decorators.
 */
import { describe, it, expect } from 'vitest';
import { RouteRegistry } from '../src/router/route-registry.js';
import { RouteBuilder } from '../src/router/route-builder.js';
import { createRouter } from '../src/router/router.js';
import { createServer } from '../src/server.js';

// ─── RouteBuilder ─────────────────────────────────────────────────────────────

describe('RouteBuilder', () => {
  it('build() produces correct method and pattern', () => {
    const b = new RouteBuilder('GET', '/users/:id', async () => {});
    const def = b.build();
    expect(def.method).toBe('GET');
    expect(def.pattern).toBe('/users/:id');
  });

  it('build() extracts paramNames from pattern', () => {
    const b = new RouteBuilder('GET', '/orgs/:org/repos/:repo', async () => {});
    expect(b.build().paramNames).toEqual(['org', 'repo']);
  });

  it('build() has empty paramNames for static pattern', () => {
    const b = new RouteBuilder('GET', '/ping', async () => {});
    expect(b.build().paramNames).toEqual([]);
  });

  it('meta() stores namespaced data', () => {
    const b = new RouteBuilder('GET', '/ping', async () => {});
    b.meta('swagger', { summary: 'Ping' }).meta('auth', { roles: ['admin'] });
    const def = b.build();
    expect(def.meta.get('swagger')).toEqual({ summary: 'Ping' });
    expect(def.meta.get('auth')).toEqual({ roles: ['admin'] });
  });

  it('meta() with different namespaces does not overwrite each other', () => {
    const b = new RouteBuilder('POST', '/users', async () => {});
    b.meta('ns1', { a: 1 }).meta('ns2', { b: 2 });
    const def = b.build();
    expect(def.meta.get('ns1')).toEqual({ a: 1 });
    expect(def.meta.get('ns2')).toEqual({ b: 2 });
  });

  it('meta() same namespace called twice overwrites', () => {
    const b = new RouteBuilder('GET', '/ping', async () => {});
    b.meta('swagger', { summary: 'v1' }).meta('swagger', { summary: 'v2' });
    expect(b.build().meta.get('swagger')).toEqual({ summary: 'v2' });
  });

  it('serialize() stores schema and uses JSON.stringify by default', () => {
    const schema = { type: 'object' };
    const b = new RouteBuilder('GET', '/ping', async () => {});
    b.serialize(schema);
    const def = b.build();
    expect(def.serializer).not.toBeNull();
    expect(def.serializer!.schema).toEqual(schema);
  });

  it('serialize() with custom compiler uses it immediately', () => {
    let compiled = false;
    const b = new RouteBuilder('GET', '/ping', async () => {});
    b.serialize({ type: 'object' }, {
      compile: (_s) => { compiled = true; return JSON.stringify; },
    });
    b.build();
    expect(compiled).toBe(true);
  });

  it('validate() stores schemas', () => {
    const bodySchema = { type: 'object', properties: { name: { type: 'string' } } };
    const b = new RouteBuilder('POST', '/users', async () => {});
    b.validate({ body: bodySchema });
    const def = b.build();
    // Without a compiler, validators are null
    expect(def.validators).toBeNull();
  });

  it('validate() with compiler produces CompiledValidator', () => {
    const b = new RouteBuilder('POST', '/users', async () => {});
    b.validate(
      { body: { type: 'object' } },
      { compile: (_schema) => (_value: unknown) => true }
    );
    const def = b.build();
    expect(def.validators).not.toBeNull();
    expect(typeof def.validators!.body).toBe('function');
  });

  it('onRequest / preHandler / onResponse / onError hooks are stored', () => {
    const b = new RouteBuilder('GET', '/ping', async () => {});
    const onReq = () => {};
    const prePre = () => {};
    const onRes = () => {};
    const onErr = () => {};
    b.onRequest(onReq).preHandler(prePre).onResponse(onRes).onError(onErr);
    const def = b.build();
    expect(def.hooks.onRequest).toContain(onReq);
    expect(def.hooks.preHandler).toContain(prePre);
    expect(def.hooks.onResponse).toContain(onRes);
    expect(def.hooks.onError).toContain(onErr);
  });
});

// ─── RouteRegistry ────────────────────────────────────────────────────────────

describe('RouteRegistry', () => {
  function makeRegistry() {
    const registry = new RouteRegistry();
    const b1 = new RouteBuilder('GET',    '/users',       async () => {});
    const b2 = new RouteBuilder('POST',   '/users',       async () => {});
    const b3 = new RouteBuilder('GET',    '/users/:id',   async () => {});
    const b4 = new RouteBuilder('DELETE', '/users/:id',   async () => {});
    const b5 = new RouteBuilder('GET',    '/admin/stats', async () => {});

    b1.meta('swagger', { tags: ['Users'] });
    b5.meta('swagger', { tags: ['Admin'] }).meta('auth', { admin: true });

    registry.add(b1.build());
    registry.add(b2.build());
    registry.add(b3.build());
    registry.add(b4.build());
    registry.add(b5.build());
    return registry;
  }

  it('all() returns all routes in insertion order', () => {
    const r = makeRegistry();
    expect(r.count).toBe(5);
    expect(r.all()[0].pattern).toBe('/users');
    expect(r.all()[4].pattern).toBe('/admin/stats');
  });

  it('byMethod() filters correctly', () => {
    const r = makeRegistry();
    expect(r.byMethod('GET')).toHaveLength(3);
    expect(r.byMethod('POST')).toHaveLength(1);
    expect(r.byMethod('DELETE')).toHaveLength(1);
    expect(r.byMethod('PUT')).toHaveLength(0);
  });

  it('byPrefix() filters correctly', () => {
    const r = makeRegistry();
    expect(r.byPrefix('/users')).toHaveLength(4);
    expect(r.byPrefix('/admin')).toHaveLength(1);
    expect(r.byPrefix('/nothing')).toHaveLength(0);
  });

  it('byMeta() filters by namespace presence', () => {
    const r = makeRegistry();
    expect(r.byMeta('swagger')).toHaveLength(2);
    expect(r.byMeta('auth')).toHaveLength(1);
    expect(r.byMeta('unknown')).toHaveLength(0);
  });

  it('toTree() returns serializable snapshot (no functions)', () => {
    const r = makeRegistry();
    const tree = r.toTree();
    expect(tree).toHaveLength(5);
    expect(tree[0]).toMatchObject({ method: 'GET', pattern: '/users', params: [] });
    expect(tree[2]).toMatchObject({ method: 'GET', pattern: '/users/:id', params: ['id'] });

    // Verify it's JSON-safe
    expect(() => JSON.stringify(tree)).not.toThrow();
  });

  it('toTree() includes meta as plain object', () => {
    const r = makeRegistry();
    const tree = r.toTree();
    const adminRoute = tree.find(t => t.pattern === '/admin/stats')!;
    expect(adminRoute.meta['swagger']).toEqual({ tags: ['Admin'] });
    expect(adminRoute.meta['auth']).toEqual({ admin: true });
  });
});

// ─── server.routes() + server.tree() integration ──────────────────────────────

describe('server.routes() and server.tree()', () => {
  it('routes() returns registry with all registered routes', async () => {
    const s = createServer();
    s.get('/a', async () => {});
    s.post('/b', async () => {});
    s.get('/c/:id', async () => {});

    await s.listen({ port: 47320 });
    s.close();

    expect(s.routes().count).toBe(3);
    expect(s.routes().all().map(r => r.pattern)).toEqual(['/a', '/b', '/c/:id']);
  });

  it('tree() returns serializable route tree', async () => {
    const s = createServer();
    s.get('/items',     async () => {});
    s.get('/items/:id', async () => {});

    await s.listen({ port: 47321 });
    s.close();

    const tree = s.tree();
    expect(tree).toHaveLength(2);
    expect(tree[1].params).toEqual(['id']);
    expect(() => JSON.stringify(tree)).not.toThrow();
  });

  it('routes() includes meta from route builder', async () => {
    const s = createServer();
    s.get('/ping', async () => {}).meta('swagger', { summary: 'Ping endpoint' });

    await s.listen({ port: 47322 });
    s.close();

    const route = s.routes().all()[0];
    expect(route.meta.get('swagger')).toEqual({ summary: 'Ping endpoint' });
  });

  it('routes() from sub-router are included', async () => {
    const s = createServer();
    const router = createRouter('/v2');
    router.get('/users', async () => {});
    router.post('/users', async () => {});
    s.use(router);

    await s.listen({ port: 47323 });
    s.close();

    expect(s.routes().count).toBe(2);
    expect(s.routes().all()[0].pattern).toBe('/v2/users');
  });
});
