/**
 * Worker: @voltrix/server (proceso aislado)
 * Mismo set de rutas que uws.worker para comparación directa.
 */
import { createServer } from '../../../packages/server/dist/index.js';

const PORT = parseInt(process.env.BENCH_PORT ?? '4004');

const staticPayload = Buffer.from(JSON.stringify({ hello: 'world', framework: '@voltrix/server' }));

const server = createServer();

// GET /
server.get('/', (ctx) => {
  ctx.json({ ok: true });
});

// GET /ping
server.get('/ping', (ctx) => {
  ctx.json({ pong: true });
});

// GET /users/:id — route param
server.get('/users/:id', (ctx) => {
  ctx.json({ id: ctx.params.id, name: 'Alice' });
});

// GET /deep/:n — 100 pre-registered routes
for (let i = 0; i < 100; i++) {
  const payload = { route: i };
  server.get(`/deep/${i}`, (ctx) => ctx.json(payload));
}

// GET /mw — 20 no-op onRequest hooks (same route name as other servers for fair comparison)
const route = server.get('/mw', (ctx) => ctx.json({ mw: true }));
for (let i = 0; i < 20; i++) {
  route.onRequest((_ctx) => { /* no-op */ });
}

// GET /static/file.json — pre-serialized Buffer (zero serialization overhead)
server.get('/static/file.json', (ctx) => {
  ctx.setHeader('Content-Type', 'application/json').send(staticPayload);
});

// POST /echo — JSON body round-trip
server.post('/echo', async (ctx) => {
  const body = await ctx.readJson();
  ctx.json(body);
});

// POST /form — URL-encoded body
server.post('/form', async (ctx) => {
  const raw = await ctx.text();
  const parsed = Object.fromEntries(new URLSearchParams(raw));
  ctx.json(parsed);
});

// POST /bytes — raw binary body (Buffer passthrough)
server.post('/bytes', async (ctx) => {
  const buf = await ctx.buffer();
  ctx.setHeader('Content-Type', 'application/octet-stream').send(buf);
});

await server.listen({ host: '127.0.0.1', port: PORT });
process.send?.({ ready: true, port: PORT });

process.on('message', (msg) => {
  if (msg === 'shutdown') {
    server.close();
    process.exit(0);
  }
});
