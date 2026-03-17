/**
 * Worker: uWebSockets.js server (proceso aislado)
 * Scenarios: root, deep routing, middleware chain, static file, URL-encoded body
 */
import * as UWS from 'uWebSockets.js';

const PORT = parseInt(process.env.BENCH_PORT ?? '4002');

const staticFile = JSON.stringify({ hello: 'world', framework: 'uws' });

function parseUrlEncoded(body) {
  return Object.fromEntries(new URLSearchParams(body));
}

const app = UWS.App();

// GET /
app.get('/', (res) => {
  res.cork(() => {
    res.writeStatus('200 OK');
    res.writeHeader('Content-Type', 'application/json');
    res.end('{"ok":true}');
  });
});

// GET /ping
app.get('/ping', (res) => {
  res.cork(() => {
    res.writeStatus('200 OK');
    res.writeHeader('Content-Type', 'application/json');
    res.end('{"pong":true}');
  });
});

// GET /users/:id
app.get('/users/:id', (res, req) => {
  const id = req.getParameter(0);
  res.cork(() => {
    res.writeStatus('200 OK');
    res.writeHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ id, name: 'Alice' }));
  });
});

// GET /deep/:n — 100 routes
for (let i = 0; i < 100; i++) {
  const val = JSON.stringify({ route: i });
  app.get(`/deep/${i}`, (res) => {
    res.cork(() => {
      res.writeStatus('200 OK');
      res.writeHeader('Content-Type', 'application/json');
      res.end(val);
    });
  });
}

// GET /mw — simulate 20 middleware no-ops (uWS has no native middleware, inline simulation)
app.get('/mw', (res) => {
  // 20 no-op increments to simulate middleware overhead
  let x = 0;
  for (let i = 0; i < 20; i++) x++;
  res.cork(() => {
    res.writeStatus('200 OK');
    res.writeHeader('Content-Type', 'application/json');
    res.end('{"mw":true}');
  });
});

// GET /static/file.json
app.get('/static/file.json', (res) => {
  res.cork(() => {
    res.writeStatus('200 OK');
    res.writeHeader('Content-Type', 'application/json');
    res.end(staticFile);
  });
});

// POST /echo — JSON body
app.post('/echo', (res) => {
  let buffer = Buffer.alloc(0);
  res.onData((chunk, isLast) => {
    buffer = Buffer.concat([buffer, Buffer.from(chunk)]);
    if (isLast) {
      res.cork(() => {
        res.writeStatus('200 OK');
        res.writeHeader('Content-Type', 'application/json');
        res.end(buffer);
      });
    }
  });
  res.onAborted(() => {});
});

// POST /form — URL-encoded body
app.post('/form', (res) => {
  let buffer = Buffer.alloc(0);
  res.onData((chunk, isLast) => {
    buffer = Buffer.concat([buffer, Buffer.from(chunk)]);
    if (isLast) {
      const parsed = parseUrlEncoded(buffer.toString());
      res.cork(() => {
        res.writeStatus('200 OK');
        res.writeHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(parsed));
      });
    }
  });
  res.onAborted(() => {});
});

app.listen('127.0.0.1', PORT, (sock) => {
  if (!sock) {
    process.send?.({ error: `uWS failed to listen on ${PORT}` });
    process.exit(1);
  }
  process.send?.({ ready: true, port: PORT });

  process.on('message', (msg) => {
    if (msg === 'shutdown') {
      UWS.us_listen_socket_close(sock);
      process.exit(0);
    }
  });
});
