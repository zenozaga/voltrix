# @voltrix/core

## 0.3.0

### Minor Changes

- c41c85e: Introduce the brand new `@voltrix/security` package, providing 6
  high-performance security modules (IP Filter, CORS, Helmet, Rate Limiter,
  CSRF, and Sessions) natively optimized for Voltrix's zero-allocation
  architecture. Add `setHeader` method to the core `IResponse` interface
  definition in `@voltrix/core`.

### Patch Changes

- c41c85e: Introduce the brand new `@voltrix/websocket` package, delivering a
  high-performance, programmatic-first and decorator-driven real-time WebSocket
  suite natively optimized for `uWebSockets.js` and `@voltrix/server`. Includes
  native C++ local pub/sub, distributed Redis pub/sub room synchronizers,
  heap-allocated asynchronous upgrade request safety, and onion-style middleware
  event pipelines.

## 0.2.1

### Patch Changes

- 288e1f2: Translate and update all package documentation and README.md files to
  English to reflect their actual functionalities and public APIs.

## 0.2.0

### Minor Changes

- 011be97: Implement high-performance batching and bulk operations support:
  - Add `addBulk` for atomic, pipelined job enqueuing to minimize network
    round-trips.
  - Add **Batch Worker Mode** (`batch: true`) with customizable `batchSize`
    (default: 64) for bulk job consumption.
  - Add optimized Lua batch acquisition scripts (`voltrixAcquireJobsBatch` and
    `voltrixAcquireJobsBatchBuffer`) with strict fallback rules.
  - Integrate comprehensive multi-process matrix performance benchmarks and
    real-world batch-mode integration tests.
