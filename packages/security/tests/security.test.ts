import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, type VoltrixServer } from '@voltrix/server';
import { security } from '../src/index.js';
import { MemoryStore } from '../src/store/memory-store.js';
import { RedisStore } from '../src/store/redis-store.js';
import { RateLimit, IpFilter } from '../src/decorators/index.js';
import { Metadata } from '@voltrix/core';
import Redis from 'ioredis';

const PORT = 47320;
const BASE = `http://localhost:${PORT}`;

describe('@voltrix/security - Core Middleware Integration Suite', () => {
  let server: VoltrixServer;

  beforeAll(async () => {
    server = createServer();

    // 1. IP Filter Endpoint
    server.get('/ip-filter', (ctx) => ctx.json({ allowed: true }));

    // 2. CORS Endpoint
    server.get('/cors', (ctx) => ctx.json({ cors: true }));
    server.post('/cors', (ctx) => ctx.json({ cors: true }));

    // 3. Helmet Endpoint
    server.get('/helmet', (ctx) => ctx.json({ helmet: true }));

    // 4. Rate Limiting Endpoint
    server.get('/rate-limit', (ctx) => ctx.json({ ok: true }));

    // 5. CSRF Endpoint
    server.get('/csrf', (ctx) => ctx.json({ ok: true }));
    server.post('/csrf', (ctx) => ctx.json({ updated: true }));

    // 6. Session Endpoint (Stateless)
    server.get('/session/stateless/get', (ctx) => {
      const sess = ctx.context.session ?? {};
      ctx.json({ views: sess.views ?? 0 });
    });
    server.get('/session/stateless/incr', (ctx) => {
      const sess = ctx.context.session ?? {};
      sess.views = (sess.views ?? 0) + 1;
      ctx.json({ views: sess.views });
    });

    // 7. Session Endpoint (Stateful with custom store)
    server.get('/session/stateful/incr', (ctx) => {
      const sess = ctx.context.session ?? {};
      sess.counter = (sess.counter ?? 0) + 1;
      ctx.json({ counter: sess.counter });
    });

    await server.listen({ port: PORT });
  });

  afterAll(async () => {
    if (server) {
      await server.close();
    }
  });

  // ─── HELMET TESTS ────────────────────────────────────────────────────────
  describe('Helmet Middleware', () => {
    it('should inject static security headers into the response', async () => {
      const app = createServer();
      app.register(security({
        helmet: {
          csp: { 'default-src': ["'self'"] },
          hsts: { maxAge: 31536000, includeSubDomains: true },
          xFrame: 'DENY',
          xContentType: true,
          referrerPolicy: 'same-origin'
        }
      }));
      app.get('/test', (ctx) => ctx.end('helmet'));
      await app.listen({ port: PORT + 1 });

      try {
        const res = await fetch(`http://localhost:${PORT + 1}/test`);
        expect(res.headers.get('Content-Security-Policy')).toBe("default-src 'self'");
        expect(res.headers.get('Strict-Transport-Security')).toBe("max-age=31536000; includeSubDomains");
        expect(res.headers.get('X-Frame-Options')).toBe('DENY');
        expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
        expect(res.headers.get('Referrer-Policy')).toBe('same-origin');
      } finally {
        await app.close();
      }
    });
  });

  // ─── CORS TESTS ──────────────────────────────────────────────────────────
  describe('CORS Middleware', () => {
    it('should handle allowed origin matching and preflight OPTIONS', async () => {
      const app = createServer();
      app.register(security({
        cors: {
          origin: 'https://client.voltrix.dev',
          credentials: true,
          methods: ['GET', 'POST'],
          allowedHeaders: ['Content-Type', 'X-CSRF-Token'],
          maxAge: 86400
        }
      }));
      app.get('/test', (ctx) => ctx.json({ ok: true }));
      await app.listen({ port: PORT + 2 });

      try {
        // 1. GET Request from allowed origin
        const res1 = await fetch(`http://localhost:${PORT + 2}/test`, {
          headers: { origin: 'https://client.voltrix.dev' }
        });
        expect(res1.headers.get('Access-Control-Allow-Origin')).toBe('https://client.voltrix.dev');
        expect(res1.headers.get('Access-Control-Allow-Credentials')).toBe('true');

        // 2. GET Request from unallowed origin
        const res2 = await fetch(`http://localhost:${PORT + 2}/test`, {
          headers: { origin: 'https://hacker.dev' }
        });
        expect(res2.headers.get('Access-Control-Allow-Origin')).toBeNull();

        // 3. Preflight OPTIONS Request
        const resOptions = await fetch(`http://localhost:${PORT + 2}/test`, {
          method: 'OPTIONS',
          headers: {
            origin: 'https://client.voltrix.dev',
            'access-control-request-method': 'POST',
            'access-control-request-headers': 'Content-Type'
          }
        });
        expect(resOptions.status).toBe(204);
        expect(resOptions.headers.get('Access-Control-Allow-Origin')).toBe('https://client.voltrix.dev');
        expect(resOptions.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST');
        expect(resOptions.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type, X-CSRF-Token');
        expect(resOptions.headers.get('Access-Control-Max-Age')).toBe('86400');
      } finally {
        await app.close();
      }
    });
  });

  // ─── IP FILTER TESTS ─────────────────────────────────────────────────────
  describe('IP Filter Middleware', () => {
    it('should whitelist authorized IPs/CIDR ranges and block unauthorized ones', async () => {
      const app = createServer();
      app.register(security({
        ipFilter: {
          whitelist: ['127.0.0.1', '10.0.0.0/8']
        }
      }));
      app.get('/test', (ctx) => ctx.json({ secure: true }));
      await app.listen({ port: PORT + 3 });

      try {
        // Since we fetch locally from localhost, getClientIp returns '127.0.0.1', which is whitelisted
        const res1 = await fetch(`http://localhost:${PORT + 3}/test`);
        expect(res1.status).toBe(200);
        expect(await res1.json()).toEqual({ secure: true });
      } finally {
        await app.close();
      }

      // Check blacklisting
      const app2 = createServer();
      app2.register(security({
        ipFilter: {
          blacklist: ['127.0.0.1']
        }
      }));
      app2.get('/test', (ctx) => ctx.json({ secure: true }));
      await app2.listen({ port: PORT + 4 });

      try {
        const res2 = await fetch(`http://localhost:${PORT + 4}/test`);
        expect(res2.status).toBe(403);
      } finally {
        await app2.close();
      }
    });
  });

  // ─── RATE LIMIT TESTS ────────────────────────────────────────────────────
  describe('Rate Limit Middleware', () => {
    it('should limit request frequency using MemoryStore', async () => {
      const app = createServer();
      app.register(security({
        rateLimit: {
          limit: 3,
          windowMs: 5000,
          keyGenerator: () => 'test-client-key'
        }
      }));
      app.get('/test', (ctx) => ctx.json({ ok: true }));
      await app.listen({ port: PORT + 5 });

      try {
        // 1st request
        const res1 = await fetch(`http://localhost:${PORT + 5}/test`);
        expect(res1.status).toBe(200);
        expect(res1.headers.get('RateLimit-Remaining')).toBe('2');

        // 2nd request
        const res2 = await fetch(`http://localhost:${PORT + 5}/test`);
        expect(res2.status).toBe(200);
        expect(res2.headers.get('RateLimit-Remaining')).toBe('1');

        // 3rd request
        const res3 = await fetch(`http://localhost:${PORT + 5}/test`);
        expect(res3.status).toBe(200);
        expect(res3.headers.get('RateLimit-Remaining')).toBe('0');

        // 4th request (exceeded)
        const res4 = await fetch(`http://localhost:${PORT + 5}/test`);
        expect(res4.status).toBe(429);
        const body = await res4.json();
        expect(body.error).toBe('Too Many Requests');
      } finally {
        await app.close();
      }
    });

    it('should limit request frequency using RedisStore if active', async () => {
      // Connect to Redis to see if active
      let redisClient: Redis | null = null;
      try {
        redisClient = new Redis({ host: '127.0.0.1', port: 6379, maxRetriesPerRequest: 1 });
        await redisClient.ping();
      } catch {
        // Skip test if Redis is not running
        if (redisClient) {
          redisClient.disconnect();
          redisClient = null;
        }
      }

      if (!redisClient) {
        console.warn('Skipping RedisStore Rate Limit test: Local Redis not running');
        return;
      }

      const store = new RedisStore(redisClient);
      const app = createServer();
      app.register(security({
        rateLimit: {
          limit: 2,
          windowMs: 5000,
          store,
          keyGenerator: () => 'redis-test-key'
        }
      }));
      app.get('/test', (ctx) => ctx.json({ ok: true }));
      await app.listen({ port: PORT + 6 });

      try {
        await store.delete('voltrix:security:rate-limit:redis-test-key');

        const res1 = await fetch(`http://localhost:${PORT + 6}/test`);
        expect(res1.status).toBe(200);

        const res2 = await fetch(`http://localhost:${PORT + 6}/test`);
        expect(res2.status).toBe(200);

        const res3 = await fetch(`http://localhost:${PORT + 6}/test`);
        expect(res3.status).toBe(429);
      } finally {
        await app.close();
        await store.close();
      }
    });
  });

  // ─── CSRF TESTS ──────────────────────────────────────────────────────────
  describe('CSRF Middleware', () => {
    it('should generate double-submit cookie token and validate mutations', async () => {
      const app = createServer();
      app.register(security({
        csrf: {
          cookieName: 'csrf_token',
          headerName: 'X-CSRF-Token'
        }
      }));
      app.get('/get-token', (ctx) => ctx.json({ ok: true }));
      app.post('/mutate', (ctx) => ctx.json({ mutated: true }));
      await app.listen({ port: PORT + 7 });

      try {
        // 1. Safe request to fetch initial token
        const resGet = await fetch(`http://localhost:${PORT + 7}/get-token`);
        expect(resGet.status).toBe(200);
        const setCookie = resGet.headers.get('Set-Cookie') || '';
        expect(setCookie).toContain('csrf_token=');

        // Parse CSRF token
        const tokenMatch = setCookie.match(/csrf_token=([^;]+)/);
        const csrfToken = tokenMatch ? tokenMatch[1] : '';
        expect(csrfToken).not.toBe('');

        // 2. POST without token header
        const resPostFail = await fetch(`http://localhost:${PORT + 7}/mutate`, {
          method: 'POST',
          headers: { Cookie: `csrf_token=${csrfToken}` }
        });
        expect(resPostFail.status).toBe(403);

        // 3. POST with correct token header and cookie matching
        const resPostSuccess = await fetch(`http://localhost:${PORT + 7}/mutate`, {
          method: 'POST',
          headers: {
            Cookie: `csrf_token=${csrfToken}`,
            'X-CSRF-Token': csrfToken
          }
        });
        expect(resPostSuccess.status).toBe(200);
        expect(await resPostSuccess.json()).toEqual({ mutated: true });
      } finally {
        await app.close();
      }
    });
  });

  // ─── SESSION TESTS ───────────────────────────────────────────────────────
  describe('Session Middleware', () => {
    const secret = 'supersecretkeymustbe32characterslong!!!';

    it('should encrypt and track stateless sessions across requests', async () => {
      const app = createServer();
      app.register(security({
        session: {
          secret,
          cookieName: 'test_session'
        }
      }));
      app.get('/incr', (ctx) => {
        const sess = ctx.context.session ?? {};
        sess.views = (sess.views ?? 0) + 1;
        ctx.json({ views: sess.views });
      });
      await app.listen({ port: PORT + 8 });

      try {
        // 1st request to increment session state
        const res1 = await fetch(`http://localhost:${PORT + 8}/incr`);
        expect(res1.status).toBe(200);
        expect(await res1.json()).toEqual({ views: 1 });
        const cookie = res1.headers.get('Set-Cookie') || '';
        expect(cookie).toContain('test_session=');

        // Extract and pass cookie back
        const match = cookie.match(/test_session=([^;]+)/);
        const sessionCookie = match ? match[1] : '';

        // 2nd request passing the encrypted session cookie
        const res2 = await fetch(`http://localhost:${PORT + 8}/incr`, {
          headers: { Cookie: `test_session=${sessionCookie}` }
        });
        expect(res2.status).toBe(200);
        expect(await res2.json()).toEqual({ views: 2 });
      } finally {
        await app.close();
      }
    });

    it('should synchronize stateful session storage with MemoryStore', async () => {
      const app = createServer();
      const store = new MemoryStore();
      app.register(security({
        session: {
          secret,
          cookieName: 'stateful_session',
          store
        }
      }));
      app.get('/incr', (ctx) => {
        const sess = ctx.context.session ?? {};
        sess.count = (sess.count ?? 0) + 1;
        ctx.json({ count: sess.count });
      });
      await app.listen({ port: PORT + 9 });

      try {
        // Increment
        const res1 = await fetch(`http://localhost:${PORT + 9}/incr`);
        expect(res1.status).toBe(200);
        expect(await res1.json()).toEqual({ count: 1 });
        const cookie = res1.headers.get('Set-Cookie') || '';

        const match = cookie.match(/stateful_session=([^;]+)/);
        const sessionCookie = match ? match[1] : '';

        // Repeat increment
        const res2 = await fetch(`http://localhost:${PORT + 9}/incr`, {
          headers: { Cookie: `stateful_session=${sessionCookie}` }
        });
        expect(res2.status).toBe(200);
        expect(await res2.json()).toEqual({ count: 2 });

        store.close();
      } finally {
        await app.close();
      }
    });
  });

  // ─── DECORATORS METADATA TESTS ──────────────────────────────────────────
  describe('Decorators & Metadata Registry', () => {
    it('should accurately write rate limiter and ip filter metadata on controller prototypes', () => {
      @IpFilter({ whitelist: ['127.0.0.1'] })
      class TestController {
        @RateLimit({ limit: 10, windowMs: 60000 })
        async run() {}
      }

      // Check class-level metadata
      const classMeta = Metadata.prefix('security').get(TestController.prototype);
      expect(classMeta).toBeDefined();
      expect(classMeta.ipFilter).toEqual({ whitelist: ['127.0.0.1'] });

      // Check method-level metadata
      const methodMeta = Metadata.prefix('security').get(TestController.prototype, 'run');
      expect(methodMeta).toBeDefined();
      expect(methodMeta.rateLimit).toEqual({ limit: 10, windowMs: 60000 });
    });
  });
});
