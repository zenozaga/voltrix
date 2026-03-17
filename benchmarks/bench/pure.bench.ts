/**
 * Benchmark: Pure Node.js HTTP (baseline)
 * Server en proceso aislado — event loop separado del cliente.
 */
import { bench, describe, beforeAll, afterAll } from 'vitest';
import { startServer, type ServerHandle } from './workers/server-harness.js';

let server: ServerHandle;

describe('Pure Node HTTP', () => {
  beforeAll(async () => {
    server = await startServer('pure.worker.mjs', 4001);
  });

  afterAll(async () => {
    await server.shutdown();
  });

  bench('GET /ping — JSON mínimo', async () => {
    await fetch(`${server.base}/ping`);
  }, {
    iterations: 10000,
  });

  bench('GET /users/:id — route param', async () => {
    await fetch(`${server.base}/users/42`);
  });

  bench('POST /echo — body parsing', async () => {
    await fetch(`${server.base}/echo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"name":"Alice","age":30}',
    });
  });
});
