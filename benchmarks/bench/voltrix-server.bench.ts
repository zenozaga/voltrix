/**
 * Benchmark: @voltrix/server
 *
 * Compares against uWS (metal ceiling) and Pure Node (baseline).
 * Server runs in an isolated child process — separate event loop from client.
 *
 * Scenarios:
 *   - GET /ping            → minimal JSON response (hot path)
 *   - GET /users/:id       → route param extraction
 *   - GET /deep/50         → 100-route radix tree lookup (depth stress)
 *   - GET /hooks           → 20-hook pipeline overhead
 *   - GET /static/file.json → pre-serialized Buffer (ctx.send bytes)
 *   - POST /echo           → JSON body read + re-serialize
 *   - POST /bytes          → raw binary Buffer passthrough
 */
import { bench, describe, beforeAll, afterAll } from 'vitest';
import { startServer, type ServerHandle } from './workers/server-harness.js';

let server: ServerHandle;

const BODY_JSON  = '{"name":"Alice","age":30}';
const BODY_BYTES = Buffer.from([0x01, 0x02, 0x03, 0x04, 0xff, 0xfe]);

describe('@voltrix/server', () => {
  beforeAll(async () => {
    server = await startServer('voltrix-server.worker.mjs', 4004);
  });

  afterAll(async () => {
    await server.shutdown();
  });

  // ── Hot path ──────────────────────────────────────────────────────────────

  bench('GET /ping — minimal JSON (hot path)', async () => {
    await fetch(`${server.base}/ping`);
  });

  // ── Routing ───────────────────────────────────────────────────────────────

  bench('GET /users/:id — route param extraction', async () => {
    await fetch(`${server.base}/users/42`);
  });

  bench('GET /deep/50 — radix tree 100-route lookup', async () => {
    await fetch(`${server.base}/deep/50`);
  });

  // ── Hook pipeline ─────────────────────────────────────────────────────────

  bench('GET /mw — 20-hook onRequest pipeline', async () => {
    await fetch(`${server.base}/mw`);
  });

  // ── Bytes (ctx.send Buffer) ───────────────────────────────────────────────

  bench('GET /static/file.json — pre-serialized Buffer passthrough', async () => {
    await fetch(`${server.base}/static/file.json`);
  });

  bench('POST /bytes — raw binary Buffer round-trip', async () => {
    await fetch(`${server.base}/bytes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: BODY_BYTES,
    });
  });

  // ── Body parsing ──────────────────────────────────────────────────────────

  bench('POST /echo — JSON body read + re-serialize', async () => {
    await fetch(`${server.base}/echo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: BODY_JSON,
    });
  });

  bench('POST /form — URL-encoded body parse', async () => {
    await fetch(`${server.base}/form`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'name=Alice&age=30',
    });
  });
});
