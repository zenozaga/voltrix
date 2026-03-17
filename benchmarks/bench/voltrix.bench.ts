/**
 * Benchmark: Voltrix
 * Server in isolated process — separate event loop from client.
 */
import { bench, describe, beforeAll, afterAll } from 'vitest';
import { startServer, type ServerHandle } from './workers/server-harness.js';

let server: ServerHandle;

describe('Voltrix', () => {
  beforeAll(async () => {
    server = await startServer('voltrix.worker.mjs', 4003);
  });

  afterAll(async () => {
    await server.shutdown();
  });

  bench('GET /ping — JSON minimo', async () => {
    await fetch(`${server.base}/ping`);
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
