/**
 * Worker: uWebSockets.js — multi-thread (1 worker_thread per CPU core)
 * uWS natively supports SO_REUSEPORT: multiple threads binding the same port.
 */
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { cpus } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const PORT = parseInt(process.env.BENCH_PORT ?? '4012');
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
  // Worker thread — each creates its own uWS app on the same port (SO_REUSEPORT)
  const require = createRequire(import.meta.url);
  const UWS = require('uWebSockets.js');

  const port = workerData.port;
  const app = UWS.App();

  app.get('/ping', (res) => {
    res.cork(() => {
      res.writeStatus('200 OK');
      res.writeHeader('Content-Type', 'application/json');
      res.end('{"pong":true}');
    });
  });

  app.get('/users/:id', (res, req) => {
    const id = req.getParameter(0);
    res.cork(() => {
      res.writeStatus('200 OK');
      res.writeHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ id, name: 'Alice' }));
    });
  });

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

  app.listen('127.0.0.1', port, (sock) => {
    if (sock) parentPort.postMessage({ ready: true });
    else parentPort.postMessage({ error: `uWS thread failed to listen on ${port}` });
  });
}
