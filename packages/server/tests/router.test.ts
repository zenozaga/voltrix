import { describe, it, expect } from 'vitest';
import { RadixTree } from '../src/router/radix-tree.js';
import { Router, createRouter } from '../src/router/router.js';
import type { CompiledRoute } from '../src/router/route-definition.js';
import { EMPTY_PIPELINE } from './helpers.js';

// ─── RadixTree ────────────────────────────────────────────────────────────────

function mockRoute(tag: string): CompiledRoute {
  return {
    handler:    async () => tag,
    onRequest:  EMPTY_PIPELINE,
    preHandler: EMPTY_PIPELINE,
    onResponse: EMPTY_PIPELINE,
    serializer: null,
    validators: null,
    paramNames: [],
  };
}

describe('RadixTree', () => {
  it('matches a static route', () => {
    const tree = new RadixTree();
    tree.insert('GET', '/ping', mockRoute('ping'));
    const m = tree.match('GET', '/ping');
    expect(m).not.toBeNull();
  });

  it('returns null for unregistered route', () => {
    const tree = new RadixTree();
    tree.insert('GET', '/ping', mockRoute('ping'));
    expect(tree.match('GET', '/pong')).toBeNull();
  });

  it('returns null for wrong method', () => {
    const tree = new RadixTree();
    tree.insert('GET', '/ping', mockRoute('ping'));
    expect(tree.match('POST', '/ping')).toBeNull();
  });

  it('extracts a single param', () => {
    const tree = new RadixTree();
    const route = mockRoute('user');
    route.paramNames = ['id'];
    tree.insert('GET', '/users/:id', route);

    const m = tree.match('GET', '/users/42');
    expect(m).not.toBeNull();
    expect(m!.paramValues).toEqual(['42']);
  });

  it('extracts multiple params', () => {
    const tree = new RadixTree();
    const route = mockRoute('repo');
    route.paramNames = ['org', 'repo'];
    tree.insert('GET', '/orgs/:org/repos/:repo', route);

    const m = tree.match('GET', '/orgs/acme/repos/api');
    expect(m).not.toBeNull();
    expect(m!.paramValues).toEqual(['acme', 'api']);
  });

  it('matches wildcard route', () => {
    const tree = new RadixTree();
    tree.insert('GET', '/static/*', mockRoute('static'));
    const m = tree.match('GET', '/static/css/main.css');
    expect(m).not.toBeNull();
    expect(m!.paramValues[0]).toBe('css/main.css');
  });

  it('prefers static over param match', async () => {
    const tree = new RadixTree();
    tree.insert('GET', '/users/me',  mockRoute('me'));
    tree.insert('GET', '/users/:id', mockRoute('id'));

    const m = tree.match('GET', '/users/me');
    expect(m?.route.handler).toBeDefined();
    // The static route should match first
    const result = await m!.route.handler({} as never);
    expect(result).toBe('me');
  });

  it('matches root path', () => {
    const tree = new RadixTree();
    tree.insert('GET', '/', mockRoute('root'));
    expect(tree.match('GET', '/')).not.toBeNull();
  });
});

// ─── Router ───────────────────────────────────────────────────────────────────

describe('Router', () => {
  it('collects builders', () => {
    const router = createRouter('/v1');
    router.get('/users', async () => {});
    router.post('/users', async () => {});
    expect(router.builders()).toHaveLength(2);
  });

  it('prefixes patterns correctly', () => {
    const router = createRouter('/api/v1');
    router.get('/users', async () => {});
    const [builder] = router.builders();
    expect(builder.pattern).toBe('/api/v1/users');
  });

  it('handles empty prefix', () => {
    const router = createRouter('');
    router.get('/ping', async () => {});
    const [builder] = router.builders();
    expect(builder.pattern).toBe('/ping');
  });

  it('handles trailing slash in prefix', () => {
    const router = createRouter('/v1/');
    router.get('/items', async () => {});
    const [builder] = router.builders();
    expect(builder.pattern).toBe('/v1/items');
  });
});
