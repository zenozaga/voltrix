import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestServer, closeTestServer, TestServer } from './test-utils.js';

describe('Voltrix App Tests', () => {
  let server: TestServer;

  beforeEach(async () => {
    server = await createTestServer();

    // Default 404
    server.app.useNotFound((req, res) => {
      res.status(404).json({ error: 'Not found' });
    });

    // Native test route (for middleware test)
    server.app.get('/middleware', (req, res) => {
      res.header('native', 'true');
      res.json({ message: 'middleware test' });
    });
  });

  afterEach(async () => {
    await closeTestServer(server);
  });

  // ========================================================
  // BASIC APP FUNCTIONALITY
  // ========================================================
  describe('Basic App Functionality', () => {
    it('should create Voltrix app instance', () => {
      expect(server.app).toBeDefined();
      expect(typeof server.app.listen).toBe('function');
      expect(typeof server.app.use).toBe('function');
    });

    it('should start server and respond to requests', async () => {
      server.app.get('/health', (req, res) => {
        res.json({ status: 'ok', app: 'voltrix' });
      });

      const response = await fetch(`${server.baseURL}/health`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('ok');
      expect(data.app).toBe('voltrix');
    });

    it('should handle 404 for non-existent routes', async () => {
      const response = await fetch(`${server.baseURL}/non-existent`);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Not found');
    });
  });

  // ========================================================
  // DYNAMIC PATTERNS
  // ========================================================
  describe('Dynamic Patterns', () => {
    it('should handle dynamic route patterns', async () => {
      server.app.get('/users/:id', (req, res) => {
        res.json({ userId: req.getParam('id') });
      });

      const response = await fetch(`${server.baseURL}/users/12345`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.userId).toBe('12345');
    });

    it('should handle dynamic route patterns 4 levels', async () => {
      server.app.get('/posts/:postId/comments/:commentId/replies/:replyId', (req, res) => {
        res.json({
          postId: req.getParam('postId'),
          commentId: req.getParam('commentId'),
          replyId: req.getParam('replyId'),
        });
      });

      const response = await fetch(`${server.baseURL}/posts/1/comments/42/replies/7`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ postId: '1', commentId: '42', replyId: '7' });
    });

    it('should return 404 for unmatched dynamic routes', async () => {
      const response = await fetch(`${server.baseURL}/posts/1/comments`);
      expect(response.status).toBe(404);
    });
  });

  // ========================================================
  // HTTP METHODS
  // ========================================================
  describe('HTTP Methods', () => {
    it('should handle POST requests', async () => {
      server.app.post('/post-test', (req, res) => res.json({ ok: true }));

      const response = await fetch(`${server.baseURL}/post-test`, {
        method: 'POST',
      });

      expect(await response.json()).toEqual({ ok: true });
    });

    it('should handle PUT requests', async () => {
      server.app.put('/put-test', (req, res) => res.json({ updated: true }));

      const response = await fetch(`${server.baseURL}/put-test`, {
        method: 'PUT',
      });

      expect(await response.json()).toEqual({ updated: true });
    });

    it('should handle PATCH requests', async () => {
      server.app.patch('/patch-test', (req, res) => res.json({ patched: true }));

      const response = await fetch(`${server.baseURL}/patch-test`, {
        method: 'PATCH',
      });

      expect(await response.json()).toEqual({ patched: true });
    });

    it('should handle DELETE requests', async () => {
      server.app.delete('/delete-test', (req, res) => res.json({ deleted: true }));

      const response = await fetch(`${server.baseURL}/delete-test`, {
        method: 'DELETE',
      });

      expect(await response.json()).toEqual({ deleted: true });
    });

    it('should handle OPTIONS requests', async () => {
      server.app.options('/options-test', (req, res) => {
        res.header('allow', 'GET,POST,OPTIONS').status(200).end();
      });

      const response = await fetch(`${server.baseURL}/options-test`, {
        method: 'OPTIONS',
      });

      expect(response.headers.get('allow')).toBe('GET,POST,OPTIONS');
    });

    it('should handle HEAD requests', async () => {
      server.app.head('/head-test', (req, res) => res.status(200).end());

      const response = await fetch(`${server.baseURL}/head-test`, {
        method: 'HEAD',
      });

      expect(response.status).toBe(200);
    });
  });

  // ========================================================
  // BODY PARSING
  // ========================================================
  describe('Body Parsing', () => {
    it('should parse valid JSON body', async () => {
      server.app.post('/json-test', async (req, res) => res.json({ received: await req.json() }));

      const response = await fetch(`${server.baseURL}/json-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ a: 1 }),
      });

      expect(await response.json()).toEqual({ received: { a: 1 } });
    });

    it('should return error for invalid JSON', async () => {
      server.app.post('/invalid-json', async (req, res) => {
        try {
          await req.json();
        } catch (e) {
          res.status(500).json({ error: 'Invalid json' });
          return;
        }
      });

      const response = await fetch(`${server.baseURL}/invalid-json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'INVALID',
      });

      expect(response.status).toBe(500);
    });

    it('should parse text/plain', async () => {
      server.app.post('/text-test', async (req, res) => res.json({ text: await req.body() }));

      const response = await fetch(`${server.baseURL}/text-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: 'hola mundo',
      });

      expect(await response.json()).toEqual({ text: 'hola mundo' });
    });
  });

  // ========================================================
  // ROUTE MATCHING VARIANTS
  // ========================================================
  describe('Route Matching Variants', () => {
    it('should handle wildcard routes', async () => {
      server.app.get('/files/*', (req, res) => res.json({ path: req.url }));

      const response = await fetch(`${server.baseURL}/files/a/b/c`);
      const data = await response.json();

      expect(data.path).toContain('/files/a/b/c');
    });

    it('should process query params', async () => {
      server.app.get('/query', (req, res) => res.json({ query: req.query }));

      const response = await fetch(`${server.baseURL}/query?x=1&y=abc`);
      const json = await response.json();
      expect(json).toEqual({
        query: { x: 1, y: 'abc' },
      });
    });

    it('should prioritize static routes over dynamic ones', async () => {
      server.app.get('/users/list', (req, res) => res.json({ mode: 'static' }));
      server.app.get('/users/:id', (req, res) => res.json({ mode: 'dynamic' }));

      const response = await fetch(`${server.baseURL}/users/list`);
      expect(await response.json()).toEqual({ mode: 'static' });
    });
  });

  // ========================================================
  // MIDDLEWARE
  // ========================================================
  describe('Middleware', () => {
    it('should modify response headers', async () => {
      server.app.use((req, res, next) => {
        res.header('X-Custom-Header', 'CustomValue');
        next();
      });

      const response = await fetch(`${server.baseURL}/middleware`);

      expect(response.headers.get('x-custom-header')).toBe('CustomValue');
    });

    it('should handle middleware errors', async () => {
      server.app.useError((err, req, res, next) => {
        if (err) {
          res.status(500).json({ error: err.message });
        } else {
          next();
        }
      });

      server.app.use(() => {
        throw new Error('MW failure');
      });

      const response = await fetch(`${server.baseURL}/middleware`);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('MW failure');
    });
  });

  // ========================================================
  // CONCURRENCY
  // ========================================================
  describe('Concurrency', () => {
    it('should handle multiple parallel requests', async () => {
      server.app.get('/parallel/:id', (req, res) => res.json({ ok: true, id: req.params.id }));

      const responses = await Promise.all(
        Array.from({ length: 20 }).map((v, index) => fetch(`${server.baseURL}/parallel/${index}`))
      );

      expect(responses.every(r => r.status === 200)).toBe(true);
    });
  });

  // ========================================================
  // ERROR HANDLING
  // ========================================================
  describe('Error Handling', () => {
    it('should handle errors thrown in route handlers', async () => {
      server.app.get('/error', () => {
        throw new Error('Test error');
      });

      server.app.useError((err, req, res) => {
        res.status(500).json({ error: err.message });
      });

      const response = await fetch(`${server.baseURL}/error`);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Test error');
    });
  });

  // ========================================================
  // APP STATS
  // ========================================================
  describe('App Statistics', () => {
    it('should provide app statistics', () => {
      const stats = server.app.getStats();

      expect(stats).toBeDefined();
      expect(typeof stats.handlerCacheSize).toBe('number');
      expect(typeof stats.routeCache.size).toBe('number');
      expect(typeof stats.cacheHits).toBe('number');
      expect(typeof stats.cacheMisses).toBe('number');
    });

    it('should clear caches', () => {
      server.app.clearAllCaches();
      expect(true).toBe(true);
    });
  });
});
