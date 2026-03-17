/**
 * Worker: Pure Node.js HTTP server (proceso aislado)
 * Scenarios: root, deep routing, middleware chain, static file, URL-encoded body
 */
import http from 'node:http';
const PORT = parseInt(process.env.BENCH_PORT ?? '4001');

// Pre-build deep route map (100 routes)
const deepRoutes = new Map();
for (let i = 0; i < 100; i++) deepRoutes.set(`/deep/${i}`, i);

// Static file content (pre-loaded)
const staticFile = JSON.stringify({ hello: 'world', framework: 'pure-node' });

// URL-encoded parser
function parseUrlEncoded(body) {
  return Object.fromEntries(new URLSearchParams(body));
}

// Simulate middleware chain: array of 20 no-op fns applied before handler
function runMiddlewares(middlewares, req, res, handler) {
  let i = 0;
  function next() {
    if (i < middlewares.length) middlewares[i++](req, res, next);
    else handler(req, res);
  }
  next();
}
const noopMiddlewares = Array.from({ length: 20 }, () => (_req, _res, next) => next());

const server = http.createServer((req, res) => {
  const url = req.url ?? '/';
  const method = req.method ?? 'GET';

  // GET /
  if (method === 'GET' && url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end('{"ok":true}');
    return;
  }

  // GET /ping
  if (method === 'GET' && url === '/ping') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end('{"pong":true}');
    return;
  }

  // GET /users/:id
  if (method === 'GET' && url.startsWith('/users/')) {
    const id = url.slice(7);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ id, name: 'Alice' }));
    return;
  }

  // GET /deep/:n — deep routing (100 routes)
  if (method === 'GET' && url.startsWith('/deep/')) {
    const val = deepRoutes.get(url);
    if (val !== undefined) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ route: val }));
      return;
    }
  }

  // GET /mw — 20 middlewares
  if (method === 'GET' && url === '/mw') {
    runMiddlewares(noopMiddlewares, req, res, (_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"mw":true}');
    });
    return;
  }

  // GET /static/file.json
  if (method === 'GET' && url === '/static/file.json') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(staticFile);
    return;
  }

  // POST /echo — JSON body
  if (method === 'POST' && url === '/echo') {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(Buffer.concat(chunks));
    });
    return;
  }

  // POST /form — URL-encoded body
  if (method === 'POST' && url === '/form') {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const parsed = parseUrlEncoded(Buffer.concat(chunks).toString());
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(parsed));
    });
    return;
  }

  res.writeHead(404).end();
});

server.listen(PORT, '127.0.0.1', () => {
  process.send?.({ ready: true, port: PORT });
});

process.on('message', (msg) => {
  if (msg === 'shutdown') server.close(() => process.exit(0));
});
