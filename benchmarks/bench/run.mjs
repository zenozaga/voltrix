/**
 * Benchmark runner: autocannon comparison
 * Single-core: Pure Node | uWebSockets.js | Voltrix
 * Multi-core:  Pure Node Cluster | uWS Multi-thread
 *
 * Runs each server in an isolated child process, then fires autocannon
 * against each scenario and prints a side-by-side comparison table.
 */
import { fork } from 'node:child_process';
import { cpus } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import autocannon from 'autocannon';

const __dirname = dirname(fileURLToPath(import.meta.url));
const NUM_CORES = cpus().length;

// ─── Config ───────────────────────────────────────────────────────────────────
const DURATION = 5;       // seconds per scenario
const CONNECTIONS = 100;  // concurrent connections
const PIPELINING = 1;

const SERVERS_SINGLE = [
  { name: 'Pure Node (1c)',      worker: 'workers/pure.worker.mjs',           port: 4001 },
  { name: 'uWS (1c)',            worker: 'workers/uws.worker.mjs',            port: 4002 },
  { name: 'Voltrix (1c)',        worker: 'workers/voltrix.worker.mjs',        port: 4003 },
  { name: '@voltrix/server (1c)', worker: 'workers/voltrix-server.worker.mjs', port: 4004 },
];

const SERVERS_MULTI = [
  { name: `Pure Cluster (${NUM_CORES}c)`, worker: 'workers/pure.cluster.worker.mjs', port: 4011 },
  { name: `uWS MT (${NUM_CORES}c)`,       worker: 'workers/uws.mt.worker.mjs',       port: 4012 },
];

const SCENARIOS = [
  { name: 'GET / — root',                method: 'GET',  path: '/' },
  { name: 'GET /ping — JSON',            method: 'GET',  path: '/ping' },
  { name: 'GET /users/:id — param',      method: 'GET',  path: '/users/42' },
  { name: 'GET /deep/99 — 100 routes',   method: 'GET',  path: '/deep/99' },
  { name: 'GET /mw — 20 middlewares',    method: 'GET',  path: '/mw' },
  { name: 'GET /static/file.json',       method: 'GET',  path: '/static/file.json' },
  {
    name: 'POST /echo — JSON body',
    method: 'POST',
    path: '/echo',
    headers: { 'content-type': 'application/json' },
    body: '{"name":"Alice","age":30}',
  },
  {
    name: 'POST /form — URL-encoded',
    method: 'POST',
    path: '/form',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: 'name=Alice&age=30',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function startServer(workerFile, port) {
  return new Promise((resolve, reject) => {
    const workerPath = join(__dirname, workerFile);
    const child = fork(workerPath, [], {
      env: { ...process.env, BENCH_PORT: String(port) },
      stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
    });

    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error(`Worker ${workerFile} timed out`));
    }, 20_000);

    child.on('message', (msg) => {
      if (msg?.ready) {
        clearTimeout(timeout);
        resolve({
          base: `http://127.0.0.1:${port}`,
          shutdown: () =>
            new Promise((res) => {
              child.once('exit', res);
              child.send('shutdown');
              setTimeout(() => { child.kill(); res(); }, 5000);
            }),
        });
      } else if (msg?.error) {
        clearTimeout(timeout);
        reject(new Error(msg.error));
      }
    });

    child.on('error', (err) => { clearTimeout(timeout); reject(err); });
    child.on('exit', (code) => {
      if (code !== 0) { clearTimeout(timeout); reject(new Error(`Worker exited with code ${code}`)); }
    });
  });
}

function runAutocannon(base, scenario) {
  return new Promise((resolve, reject) => {
    autocannon(
      {
        url: base + scenario.path,
        method: scenario.method ?? 'GET',
        headers: scenario.headers,
        body: scenario.body,
        duration: DURATION,
        connections: CONNECTIONS,
        pipelining: PIPELINING,
        silent: true,
      },
      (err, result) => {
        if (err) return reject(err);
        resolve(result);
      }
    );
  });
}

function fmt(n) {
  return n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(2)}M`
    : n >= 1000
    ? `${(n / 1000).toFixed(1)}k`
    : String(Math.round(n));
}

function pad(str, len) {
  return String(str).padEnd(len);
}

function printTable(servers, rows) {
  const colW = 22;
  const scenW = 30;
  const names = servers.map((s) => s.name);

  const header = '│ ' + pad('Scenario', scenW) + ' ' +
    names.map((n) => '│ ' + pad(n, colW) + ' ').join('') + '│';

  console.log('┌' + '─'.repeat(scenW + 2) + names.map(() => '┬' + '─'.repeat(colW + 2)).join('') + '┐');
  console.log(header);
  console.log('├' + '─'.repeat(scenW + 2) + names.map(() => '┼' + '─'.repeat(colW + 2)).join('') + '┤');

  for (const row of rows) {
    const cells = row.results.map(({ reqSec, p99 }) => {
      const cell = `${fmt(reqSec)} req/s  p99=${p99}ms`;
      return '│ ' + pad(cell, colW) + ' ';
    });
    console.log('│ ' + pad(row.scenario, scenW) + ' ' + cells.join('') + '│');
  }

  console.log('└' + '─'.repeat(scenW + 2) + names.map(() => '┴' + '─'.repeat(colW + 2)).join('') + '┘');
}

async function runSuite(servers, label) {
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`  ${label}`);
  console.log(`${'─'.repeat(70)}`);

  const handles = await Promise.all(servers.map((s) => startServer(s.worker, s.port)));

  // Warmup
  process.stdout.write('  Warming up... ');
  await Promise.all(
    handles.map((h) =>
      new Promise((resolve) =>
        autocannon({ url: `${h.base}/ping`, duration: 2, connections: 50, silent: true }, resolve)
      )
    )
  );
  console.log('done\n');

  const rows = [];

  for (const scenario of SCENARIOS) {
    console.log(`  📊 ${scenario.name}`);
    const scenarioResults = [];

    for (let i = 0; i < servers.length; i++) {
      const server = servers[i];
      const handle = handles[i];
      process.stdout.write(`     ${server.name.padEnd(24)} ... `);

      const result = await runAutocannon(handle.base, scenario);
      const reqSec = Math.round(result.requests.average);
      const p99 = result.latency.p99.toFixed(1);
      const p75 = result.latency.p75.toFixed(1);
      const mean = result.latency.mean.toFixed(1);

      console.log(`${fmt(reqSec)} req/s  p75=${p75}ms  p99=${p99}ms`);
      scenarioResults.push({ name: server.name, reqSec, p99, p75, mean });
    }

    rows.push({ scenario: scenario.name, results: scenarioResults });
  }

  await Promise.all(handles.map((h) => h.shutdown()));
  return rows;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🚀 Voltrix Benchmark Suite  (${NUM_CORES} CPU cores detected)\n`);

  const rowsSingle = await runSuite(SERVERS_SINGLE, '── SINGLE-CORE (1 thread each)');
  const rowsMulti  = await runSuite(SERVERS_MULTI,  `── MULTI-CORE  (${NUM_CORES} threads each)`);

  // ── Summary ──
  console.log('\n' + '═'.repeat(70));
  console.log('  SINGLE-CORE SUMMARY');
  console.log('═'.repeat(70));
  printTable(SERVERS_SINGLE, rowsSingle);

  console.log('\n' + '═'.repeat(70));
  console.log(`  MULTI-CORE SUMMARY  (${NUM_CORES} cores)`);
  console.log('═'.repeat(70));
  printTable(SERVERS_MULTI, rowsMulti);

  // ── Scale-up ratio (multi vs single baseline) ──
  console.log('\n  Scale-up: multi-core vs single-core Pure Node baseline');
  console.log('  ' + '─'.repeat(60));
  const singleBaselines = Object.fromEntries(
    rowsSingle.map((r) => [r.scenario, r.results[0].reqSec])
  );
  for (const row of rowsMulti) {
    const baseline = singleBaselines[row.scenario] ?? 1;
    const ratios = row.results
      .map((r, i) => `${SERVERS_MULTI[i].name}: ${(r.reqSec / baseline).toFixed(2)}x`)
      .join('  ');
    console.log(`  ${row.scenario.padEnd(34)} ${ratios}`);
  }

  console.log('\n✅ Done.\n');
}

main().catch((err) => {
  console.error('\nBenchmark failed:', err);
  process.exit(1);
});
