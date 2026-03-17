/**
 * Benchmark: async patterns overhead
 *
 * Compares the cost of the async machinery itself — not the work done.
 * Each pattern runs N steps that do minimal work (increment a counter).
 * Goal: find the cheapest way to chain N operations in a request pipeline.
 *
 * Patterns tested:
 *   1. async/await chain          — baseline, most readable
 *   2. Promise.then() chain       — explicit promise chaining
 *   3. Callback chain (err-first) — classic Node.js
 *   4. Thenable check runner      — await only if Promise returned
 *   5. Pre-classified sync runner — zero Promise machinery when all sync
 *   6. Pre-classified mixed       — sync fast path + async escape
 */

import { performance } from 'node:perf_hooks'

const ITERATIONS = 500_000
const STEPS      = 5       // simulates 5 hooks in a pipeline
const WARMUP     = 50_000

// ─── Shared context (simulates ctx object) ────────────────────────────────────

function makeCtx() {
  return { count: 0, state: {} }
}

// ─── Step implementations (same work, different signatures) ──────────────────

// Async step (returns Promise)
async function asyncStep(ctx)  { ctx.count++ }

// Sync step (returns undefined)
function syncStep(ctx)         { ctx.count++ }

// Callback step (err-first)
function cbStep(ctx, next)     { ctx.count++; next(null) }

// Thenable step — sometimes sync, sometimes async (realistic)
function mixedStep(ctx) {
  ctx.count++
  // Returns Promise only every 3rd call — simulates real hooks
  // where most are sync but some do async work (auth, rate limit, etc.)
  if (ctx.count % 3 === 0) return Promise.resolve()
  // undefined = sync, no Promise overhead
}

// ─── Pattern 1: async/await ───────────────────────────────────────────────────

const asyncSteps = Array(STEPS).fill(asyncStep)

async function runAsyncAwait(ctx) {
  for (let i = 0; i < asyncSteps.length; i++) {
    await asyncSteps[i](ctx)
  }
}

// ─── Pattern 2: Promise.then() chain ─────────────────────────────────────────

function runPromiseThen(ctx) {
  let p = Promise.resolve()
  for (let i = 0; i < STEPS; i++) {
    p = p.then(() => asyncStep(ctx))
  }
  return p
}

// ─── Pattern 3: Callback chain (err-first, nested) ───────────────────────────

const cbSteps = Array(STEPS).fill(cbStep)

function runCallbackChain(ctx, done) {
  let i = 0
  function next(err) {
    if (err || i >= cbSteps.length) return done(err ?? null)
    cbSteps[i++](ctx, next)
  }
  next(null)
}

// Wrap in Promise for fair timing
function runCallbackChainP(ctx) {
  return new Promise((resolve, reject) => {
    runCallbackChain(ctx, (err) => err ? reject(err) : resolve())
  })
}

// ─── Pattern 4: Thenable check — only await if result is Promise ──────────────
// The key optimization: sync hooks pay zero Promise overhead

const thenableSteps = Array(STEPS).fill(syncStep) // all sync

async function runThenableCheck(ctx) {
  for (let i = 0; i < thenableSteps.length; i++) {
    const r = thenableSteps[i](ctx)
    if (r !== null && r !== undefined && typeof r.then === 'function') {
      await r
    }
  }
}

// ─── Pattern 5: Pre-classified — detected at startup, zero checks in hot path

// Simulates: at route registration, server detects all hooks are sync
// → uses a tight sync loop, no async machinery at all
function runPreClassifiedSync(ctx) {
  // Pure sync — no async overhead whatsoever
  for (let i = 0; i < STEPS; i++) {
    syncStep(ctx)
  }
  return Promise.resolve() // single Promise at the end (still need one for pipeline)
}

// ─── Pattern 6: Mixed — pre-classified with async escape hatch ───────────────
// Some hooks sync, some async — detected at startup

const mixedSteps = Array(STEPS).fill(mixedStep)

async function runPreClassifiedMixed(ctx) {
  for (let i = 0; i < mixedSteps.length; i++) {
    const r = mixedSteps[i](ctx)
    if (r !== null && r !== undefined && typeof r.then === 'function') {
      await r
    }
  }
}

// ─── Benchmark runner ─────────────────────────────────────────────────────────

async function bench(name, fn, iterations = ITERATIONS) {
  const ctx = makeCtx()

  // Warmup
  for (let i = 0; i < WARMUP; i++) await fn(ctx)

  // Force GC if available
  if (global.gc) global.gc()

  const memBefore = process.memoryUsage().heapUsed
  const start     = performance.now()

  for (let i = 0; i < iterations; i++) {
    await fn(ctx)
  }

  const elapsed   = performance.now() - start
  const memAfter  = process.memoryUsage().heapUsed
  const opsPerSec = Math.round(iterations / (elapsed / 1000))
  const memDelta  = ((memAfter - memBefore) / 1024 / 1024).toFixed(2)
  const nsPerOp   = ((elapsed / iterations) * 1e6).toFixed(1)

  return { name, opsPerSec, nsPerOp, memDelta, elapsed: elapsed.toFixed(1) }
}

// ─── Run all ──────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nAsync pattern overhead — ${STEPS} steps, ${ITERATIONS.toLocaleString()} iterations`)
  console.log(`Node.js ${process.version}  |  run with --expose-gc for accurate memory\n`)

  const results = []

  results.push(await bench('1. async/await (all async steps)',         runAsyncAwait))
  results.push(await bench('2. Promise.then() chain',                  runPromiseThen))
  results.push(await bench('3. Callback chain (err-first)',            runCallbackChainP))
  results.push(await bench('4. Thenable check (all sync steps)',       runThenableCheck))
  results.push(await bench('5. Pre-classified sync (zero async)',      runPreClassifiedSync))
  results.push(await bench('6. Pre-classified mixed (some async)',     runPreClassifiedMixed))

  // ─── Table output ──────────────────────────────────────────────────────────

  const maxName = Math.max(...results.map(r => r.name.length))
  const fastest = Math.max(...results.map(r => r.opsPerSec))

  console.log(
    'Pattern'.padEnd(maxName),
    'ops/sec'.padStart(12),
    'ns/op'.padStart(8),
    'mem Δ MB'.padStart(10),
    'ratio'.padStart(7)
  )
  console.log('─'.repeat(maxName + 42))

  for (const r of results) {
    const ratio = (r.opsPerSec / fastest * 100).toFixed(1)
    const bar   = '█'.repeat(Math.round(+ratio / 10))
    console.log(
      r.name.padEnd(maxName),
      r.opsPerSec.toLocaleString().padStart(12),
      `${r.nsPerOp}ns`.padStart(8),
      `${r.memDelta}`.padStart(10),
      `${ratio}%`.padStart(7),
      ` ${bar}`
    )
  }

  // ─── Key findings ──────────────────────────────────────────────────────────

  const asyncAwait  = results[0].opsPerSec
  const cbChain     = results[2].opsPerSec
  const syncZero    = results[4].opsPerSec
  const thenCheck   = results[3].opsPerSec

  console.log('\n── Key findings ──────────────────────────────────────────────')
  console.log(`Callback vs async/await:      ${(cbChain / asyncAwait).toFixed(2)}x`)
  console.log(`Thenable-check vs async/await: ${(thenCheck / asyncAwait).toFixed(2)}x  (sync hooks, thenable check)`)
  console.log(`Pre-classified sync vs async:  ${(syncZero / asyncAwait).toFixed(2)}x  (zero async overhead)`)
  console.log(`Pre-classified sync vs CB:     ${(syncZero / cbChain).toFixed(2)}x`)
  console.log('──────────────────────────────────────────────────────────────\n')
}

main().catch(console.error)
