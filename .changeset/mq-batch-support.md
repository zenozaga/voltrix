---
"@voltrix/mq": minor
"@voltrix/core": minor
"@voltrix/server": minor
"@voltrix/events": minor
"@voltrix/express": minor
"@voltrix/decorator": minor
"@voltrix/injector": minor
"@voltrix/swagger": minor
---

Implement high-performance batching and bulk operations support:
- Add `addBulk` for atomic, pipelined job enqueuing to minimize network round-trips.
- Add **Batch Worker Mode** (`batch: true`) with customizable `batchSize` (default: 64) for bulk job consumption.
- Add optimized Lua batch acquisition scripts (`voltrixAcquireJobsBatch` and `voltrixAcquireJobsBatchBuffer`) with strict fallback rules.
- Integrate comprehensive multi-process matrix performance benchmarks and real-world batch-mode integration tests.
