/**
 * Isolated benchmark: POST /form — URL-encoded body parsing
 * Compares Pure Node | uWS | Voltrix
 */
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import autocannon from 'autocannon';

const __dirname = dirname(fileURLToPath(import.meta.url));

const DURATION = 10;
const CONNECTIONS = 100;

const SERVERS = [
  { name: 'Pure Node', worker: 'workers/pure.worker.mjs',    port: 5001 },
  { name: 'uWS',       worker: 'workers/uws.worker.mjs',     port: 5002 },
  { name: 'Voltrix',   worker: 'workers/voltrix.worker.mjs', port: 5003 },
];

const SCENARIO = {
  path: '/form',
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: 'name=Alice&age=30',
};

function startServer(workerFile, port) {
  return new Promise((resolve, reject) => {
    const child = fork(join(__dirname, workerFile), [], {
      env: { ...process.env, BENCH_PORT: String(port) },
      stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
    });
    const t = setTimeout(() => { child.kill(); reject(new Error('timeout')); }, 15_000);
    child.on('message', (msg) => {
      if (msg?.ready) {
        clearTimeout(t);
        resolve({
          base: `http://127.0.0.1:${port}`,
          shutdown: () => new Promise((res) => {
            child.once('exit', res);
            child.send('shutdown');
            setTimeout(() => { child.kill(); res(); }, 3000);
          }),
        });
      } else if (msg?.error) { clearTimeout(t); reject(new Error(msg.error)); }
    });
    child.on('error', (e) => { clearTimeout(t); reject(e); });
    child.on('exit', (code) => { if (code !== 0) { clearTimeout(t); reject(new Error(`exit ${code}`)); } });
  });
}

function bench(base) {
  return new Promise((resolve, reject) => {
    autocannon({
      url: base + SCENARIO.path,
      method: SCENARIO.method,
      headers: SCENARIO.headers,
      body: SCENARIO.body,
      duration: DURATION,
      connections: CONNECTIONS,
      silent: true,
    }, (err, result) => err ? reject(err) : resolve(result));
  });
}

async function main() {
  console.log('\n🔬 Isolated: POST /form — URL-encoded body parsing\n');

  // Start servers
  const handles = await Promise.all(SERVERS.map((s) => startServer(s.worker, s.port)));

  // Warmup
  process.stdout.write('Warming up... ');
  await Promise.all(handles.map((h) => new Promise((res) =>
    autocannon({ url: `${h.base}/ping`, duration: 2, connections: 20, silent: true }, res)
  )));
  console.log('done\n');

  // Probe one request manually to check response body
  console.log('Probing responses:');
  for (let i = 0; i < SERVERS.length; i++) {
    const r = await fetch(handles[i].base + SCENARIO.path, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'name=Alice&age=30',
    });
    const body = await r.text();
    console.log(`  ${SERVERS[i].name.padEnd(12)} HTTP ${r.status}  ${body}`);
  }
  console.log('');

  // Run benchmark
  const results = [];
  for (let i = 0; i < SERVERS.length; i++) {
    process.stdout.write(`Running ${SERVERS[i].name.padEnd(12)} ... `);
    const result = await bench(handles[i].base);
    const reqSec = Math.round(result.requests.average);
    const p50 = result.latency.p50.toFixed(1);
    const p99 = result.latency.p99.toFixed(1);
    const errors = result.errors + result['4xx'] + result['5xx'];
    console.log(`${(reqSec / 1000).toFixed(1)}k req/s  p50=${p50}ms  p99=${p99}ms  errors=${errors}`);
    results.push({ name: SERVERS[i].name, reqSec, p50, p99, errors });
  }

  // Summary
  console.log('\n─────────────────────────────────────────');
  const best = Math.max(...results.map((r) => r.reqSec));
  for (const r of results) {
    const bar = '█'.repeat(Math.round((r.reqSec / best) * 30));
    console.log(`  ${r.name.padEnd(12)} ${(r.reqSec / 1000).toFixed(1)}k  ${bar}`);
  }
  console.log('');

  await Promise.all(handles.map((h) => h.shutdown()));
  console.log('✅ Done.\n');
}

main().catch((e) => { console.error(e); process.exit(1); });
