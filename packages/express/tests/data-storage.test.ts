import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestServer, closeTestServer, TestServer } from './test-utils.js';

describe('Data Storage (Locals/Context)', () => {
  let server: TestServer;

  beforeEach(async () => {
    server = await createTestServer();
  });

  afterEach(async () => {
    await closeTestServer(server);
  });

  it('should allow sharing data via req.context and res.locals', async () => {
    server.app.use((req, res, next) => {
      req.context.userId = 'user_123';
      res.locals.title = 'Dashboard';
      next();
    });

    server.app.get('/test-data', (req, res) => {
      res.json({
        contextUser: req.context.userId,
        localsTitle: res.locals.title
      });
    });

    const response = await fetch(`${server.baseURL}/test-data`);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.contextUser).toBe('user_123');
    expect(data.localsTitle).toBe('Dashboard');
  });

  it('should reset context and locals for new requests (Pooling Safety)', async () => {
    // Request 1: Sets data
    server.app.get('/set-data', (req, res) => {
      req.context.dirty = true;
      res.locals.dirty = true;
      res.send('set');
    });

    // Request 2: Should be clean
    server.app.get('/check-data', (req, res) => {
      res.json({
        contextWasDirty: !!req.context.dirty,
        localsWasDirty: !!res.locals.dirty
      });
    });

    // Run sequentially to increase chance of pool reuse
    // (Initialize resets them anyway, so it should always pass)
    await fetch(`${server.baseURL}/set-data`);
    
    const response = await fetch(`${server.baseURL}/check-data`);
    const data = await response.json();

    expect(data.contextWasDirty).toBe(false);
    expect(data.localsWasDirty).toBe(false);
  });
});
