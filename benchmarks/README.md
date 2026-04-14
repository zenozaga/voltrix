# Benchmarks

This package contains the benchmark runners used to compare `@voltrix/server`,
`@voltrix/express`, `uWebSockets.js`, and plain Node baselines.

## Requirements

- Node.js `>=20`
- Workspace dependencies installed
- Built package outputs for the workers that import `dist/`

Before running the benchmarks, rebuild the workspace or at least the packages
used by the workers:

```bash
pnpm build
```

If you only care about the server benches:

```bash
pnpm --filter @voltrix/server build
pnpm --filter @voltrix/express build
```

## Scripts

From the repo root:

```bash
pnpm bench
pnpm bench:vitest
pnpm bench:server
```

From the `benchmarks/` directory:

```bash
pnpm bench
pnpm bench:vitest
pnpm bench:server
```

What each script does:

- `bench`: runs the end-to-end `autocannon` comparison in [bench/run.mjs](./bench/run.mjs)
- `bench:vitest`: runs all Vitest benchmark files with [vitest.config.ts](./vitest.config.ts)
- `bench:server`: runs only [voltrix-server.bench.ts](./bench/voltrix-server.bench.ts)

## Current Suites

### Autocannon runner

[run.mjs](./bench/run.mjs) starts isolated workers and compares:

- Pure Node.js single-core
- uWebSockets.js single-core
- Voltrix single-core
- `@voltrix/server` single-core
- Pure Node.js cluster
- uWebSockets.js multi-thread
- `@voltrix/server` multi-thread

The scenarios currently exercised are:

- `GET /`
- `GET /ping`
- `GET /users/:id`
- `GET /deep/99`
- `GET /mw`
- `GET /static/file.json`
- `POST /echo`
- `POST /form`

### Vitest benches

The package currently ships these benchmark files:

- [pure.bench.ts](./bench/pure.bench.ts)
- [uws.bench.ts](./bench/uws.bench.ts)
- [voltrix.bench.ts](./bench/voltrix.bench.ts)
- [voltrix-server.bench.ts](./bench/voltrix-server.bench.ts)

There are also ad-hoc runners for focused experiments:

- [form.bench.mjs](./bench/form.bench.mjs)
- [async-patterns.mjs](./bench/async-patterns.mjs)

## Notes

- The worker files import `packages/*/dist`, not `src`. If you benchmark stale
  builds, you benchmark stale code.
- The `autocannon` runner is localhost-on-localhost. For multi-core scale-up
  analysis, the client can become the bottleneck before the server does.
- If you are validating scale-up, increase concurrency and prefer a stronger
  external load generator instead of relying on a single local client process.

## Windows `sb`

If you want to validate a single server outside the built-in runner with
SuperBenchmarker in Windows, first start the desired worker in one terminal:

Single-core:

```powershell
cd D:\zenozaga\Github\accounts\zenozaga\projects\@zenofolio\voltrix\benchmarks
$env:BENCH_PORT=4004
node .\bench\workers\voltrix-server.worker.mjs
```

Multi-core:

```powershell
cd D:\zenozaga\Github\accounts\zenozaga\projects\@zenofolio\voltrix\benchmarks
$env:BENCH_PORT=4013
node .\bench\workers\voltrix-server.mt.worker.mjs
```

Then run `sb` from another Windows terminal:

```powershell
sb -u http://127.0.0.1:4004/ping -c 256 -N 15 -W 0 -P 1 -B
sb -u http://127.0.0.1:4013/ping -c 256 -N 15 -W 0 -P 1 -B
```
