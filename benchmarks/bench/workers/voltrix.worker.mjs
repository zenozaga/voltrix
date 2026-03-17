/**
 * Worker: Voltrix server (proceso aislado)
 * Scenarios: root, deep routing, middleware chain, static file, URL-encoded body
 */
import { voltrix } from '../../../packages/express/dist/index.js';

const PORT = parseInt(process.env.BENCH_PORT ?? '4003');

const staticFile = JSON.stringify({ hello: 'world', framework: 'voltrix' });

function parseUrlEncoded(body) {
  return Object.fromEntries(new URLSearchParams(body));
}

const app = voltrix();

// 20 no-op middlewares for the /mw route
const noopMw = (_req, _res, next) => next();

// GET /
app.get('/', (_req, res) => {
  res.json({ ok: true });
});

// GET /ping
app.get('/ping', (_req, res) => {
  res.json({ pong: true });
});

// GET /users/:id
app.get('/users/:id', (req, res) => {
  const id = req.getParam('id');
  res.json({ id, name: 'Alice' });
});

// GET /deep/:n — 100 routes
for (let i = 0; i < 100; i++) {
  const payload = { route: i };
  app.get(`/deep/${i}`, (_req, res) => res.json(payload));
}

// GET /mw — 20 middlewares
for (let i = 0; i < 20; i++) app.use('/mw', noopMw);
app.get('/mw', (_req, res) => res.json({ mw: true }));

// GET /static/file.json
app.get('/static/file.json', (_req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(staticFile);
});

// POST /echo — JSON body
app.post('/echo', async (req, res) => {
  const body = await req.json();
  res.json(body);
});

// POST /form — URL-encoded body
app.post('/form', async (req, res) => {
  const raw = await req.body();
  res.json(parseUrlEncoded(raw));
});

await app.listen(PORT);
process.send?.({ ready: true, port: PORT });

process.on('message', (msg) => {
  if (msg === 'shutdown') app.close().then(() => process.exit(0));
});
