/**
 * Worker: Pure Node.js HTTP — cluster mode (1 process per CPU core)
 */
import cluster from 'node:cluster';
import { cpus } from 'node:os';
import http from 'node:http';

const PORT = parseInt(process.env.BENCH_PORT ?? '4011');
const NUM_WORKERS = cpus().length;

function createServer() {
  return http.createServer((req, res) => {
    const url = req.url ?? '/';

    if (req.method === 'GET' && url === '/ping') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"pong":true}');
      return;
    }

    if (req.method === 'GET' && url.startsWith('/users/')) {
      const id = url.slice(7);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ id, name: 'Alice' }));
      return;
    }

    if (req.method === 'POST' && url === '/echo') {
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(Buffer.concat(chunks));
      });
      return;
    }

    res.writeHead(404).end();
  });
}

if (cluster.isPrimary) {
  let ready = 0;

  for (let i = 0; i < NUM_WORKERS; i++) cluster.fork();

  cluster.on('online', () => {
    ready++;
    if (ready === NUM_WORKERS) {
      process.send?.({ ready: true, port: PORT, workers: NUM_WORKERS });
    }
  });

  process.on('message', (msg) => {
    if (msg === 'shutdown') {
      for (const id in cluster.workers) cluster.workers[id]?.kill();
      process.exit(0);
    }
  });
} else {
  createServer().listen(PORT, '127.0.0.1');
}
