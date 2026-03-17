/**
 * Worker: @voltrix/server — multi-thread (1 worker_thread per CPU core)
 * uWS natively supports SO_REUSEPORT: multiple threads bind the same port.
 * Each thread creates its own VoltrixServer instance — fully isolated state.
 */
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { cpus } from 'node:os';
import { fileURLToPath } from 'node:url';

const PORT = parseInt(process.env.BENCH_PORT ?? '4013');
const NUM_THREADS = cpus().length;

if (isMainThread) {
  let ready = 0;
  const workers = [];

  for (let i = 0; i < NUM_THREADS; i++) {
    const w = new Worker(fileURLToPath(import.meta.url), {
      workerData: { port: PORT },
    });

    workers.push(w);

    w.on('message', (msg) => {
      if (msg?.ready) {
        ready++;
        if (ready === NUM_THREADS) {
          process.send?.({ ready: true, port: PORT, workers: NUM_THREADS });
        }
      } else if (msg?.error) {
        process.send?.({ error: msg.error });
      }
    });

    w.on('error', (err) => process.send?.({ error: err.message }));
  }

  process.on('message', (msg) => {
    if (msg === 'shutdown') {
      for (const w of workers) w.terminate();
      process.exit(0);
    }
  });
} else {
  // Worker thread — each creates its own VoltrixServer on the same port (SO_REUSEPORT)
  const { createServer } = await import('../../../packages/server/dist/index.js');

  const port = workerData.port;
  const staticPayload = Buffer.from(JSON.stringify({ hello: 'world', framework: '@voltrix/server' }));

  const server = createServer();

  server.get('/', (ctx) => ctx.json({ ok: true }));
  server.get('/ping', (ctx) => ctx.json({ pong: true }));

  server.get('/users/:id', (ctx) => {
    ctx.json({ id: ctx.params.id, name: 'Alice' });
  });

  for (let i = 0; i < 100; i++) {
    const payload = { route: i };
    server.get(`/deep/${i}`, (ctx) => ctx.json(payload));
  }

  const mwRoute = server.get('/mw', (ctx) => ctx.json({ mw: true }));
  for (let i = 0; i < 20; i++) mwRoute.onRequest((_ctx) => {});

  server.get('/static/file.json', (ctx) => {
    ctx.setHeader('Content-Type', 'application/json').send(staticPayload);
  });

  server.post('/echo', async (ctx) => {
    const body = await ctx.readJson();
    ctx.json(body);
  });

  server.post('/form', async (ctx) => {
    const raw = await ctx.text();
    ctx.json(Object.fromEntries(new URLSearchParams(raw)));
  });

  try {
    await server.listen({ host: '127.0.0.1', port });
    parentPort.postMessage({ ready: true });
  } catch (err) {
    parentPort.postMessage({ error: err.message });
  }
}
