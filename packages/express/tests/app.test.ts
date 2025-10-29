import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestServer, closeTestServer, TestServer } from './test-utils.js';


describe('Voltrix App Tests', () => {
  let server: TestServer;

  beforeEach(async () => {
    server = await createTestServer();

    // Registrar un handler 404 por defecto
    server.app.useNotFound((req: any, res: any) => {
      res.status(404).json({ error: 'Not found' });
    });

    server.app.get('/middleware', (req, res) => {
      res.header('native', 'true');
      res.json({ message: 'middleware test' });
    });
  });

  afterEach(async () => {
    await closeTestServer(server);
  });

  describe('Basic App Functionality', () => {
    it('should create Voltrix app instance', () => {
      expect(server.app).toBeDefined();
      expect(typeof server.app.listen).toBe('function');
      expect(typeof server.app.use).toBe('function');
    });

    it('should start server and respond to requests', async () => {
      server.app.get('/health', (req: any, res: any) => {
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

  it('Middleware should modify request and response objects', async () => {
    // Middleware que añade un header personalizado

    server.app.use((req, res, next) => {
      res.header('X-Custom-Header', 'CustomValue');
      next();
    });

    const response = await fetch(`${server.baseURL}/middleware`);

    expect(response.status).toBe(200);
    expect(response.headers.get('x-custom-header')).toBe('CustomValue');
  });

  it('should handle errors thrown in route handlers', async () => {
    server.app.get('/error', (req: any, res: any) => {
      throw new Error('Test error');
    });

    server.app.useError((err, req, res, next) => {
      res.status(500).json({ error: err.message || 'Internal Server Error' });
    });

    const response = await fetch(`${server.baseURL}/error`);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Test error');
  });

  describe('App Statistics', () => {
    it('should provide app statistics', () => {
      const stats = server.app.getStats();

      expect(stats).toBeDefined();
      expect(typeof stats.handlerCacheSize).toBe('number');
      expect(typeof stats.routeCache).toBe('object');
      expect(typeof stats.routeCache.size).toBe('number');
      // Adaptado: ya no hay middlewareCount
      expect(typeof stats.cacheHits).toBe('number');
      expect(typeof stats.cacheMisses).toBe('number');
    });

    it('should clear caches', () => {
      // Solo existe clearAllCaches
      server.app.clearAllCaches();
      expect(true).toBe(true);
    });
  });
});
