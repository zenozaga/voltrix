# @voltrix/mq

A distributed, ultra-high-performance, strongly-typed message queue built directly on `ioredis` with native support for glob pattern-based group-level concurrency (Noisy-Neighbor mitigation), lease heartbeats, dead-letter queue (DLQ) poison-pill isolation, strongly-typed lifecycle event emitters, atomic cron rescheduling, and traceability correlation traces.

---

## 🏎️ Benchmark Performance (Real-World Multi-Process Metrics)

We verified `@voltrix/mq` under real-world conditions using a suite of multi-process benchmarks executing on isolated child processes:

### 1. Matrix Performance Benchmark (`bench:perf`)
* **Configuration**: 1 Producer, 4 Consumers, 10,000 Jobs, 20,000 total concurrency cap (5,000 concurrent slots per consumer).
* **Results Matrix**:
  | Scenario | Produce Duration (s) | Produce Rate (jobs/s) | Consume Duration (s) | Consume Rate (jobs/s) | Speedup vs Baseline |
  | :--- | :---: | :---: | :---: | :---: | :---: |
  | **Single Enqueue ➔ Single Worker** *(Baseline)* | 0.434s | 23,041 j/s | 2.080s | 4,808 j/s | *Baseline* |
  | **Bulk Enqueue ➔ Single Worker** | 0.482s | 20,747 j/s | 2.105s | 4,751 j/s | ~1.00x |
  | **Single Enqueue ➔ Batch Worker** | 0.446s | 22,422 j/s | **0.616s** | **16,234 j/s** | **3.37x** 🚀 |
  | **Bulk Enqueue ➔ Batch Worker** *(Optimal)* | 0.555s | 18,018 j/s | **0.682s** | **14,663 j/s** | **3.04x** 🚀 |
* **Optimization**: **Batch Worker Mode** (`batch: true` with `batchSize: 64`) reduces network round-trip overhead and event loop contention, boosting throughput by up to **3.3x+** to process over **16,000 jobs/second** under heavy concurrent loads!

### 2. Concurrency Limits Benchmark (`bench:limits`)
* **Configuration**: 2 Consumers, 1 Producer, 30 Jobs with a 100ms simulated task delay.
* **Regla `tenant.heavy.*` (Límite: 1)**: Concurrencia máxima: **1 activa**. Tiempo: 1.133s. Tasa: **8.83 trabajos/seg**.
* **Regla `tenant.light.*` (Límite: 10)**: Concurrencia máxima: **10 activas**. Tiempo: 0.113s. Tasa: **88.50 trabajos/seg**.
* **Regla `*` (Comodín Fallback)**: Concurrencia máxima: **1 activa**. Tiempo: 1.107s. Tasa: **9.03 trabajos/seg**.
* **Status**: **✅ SUCCESS (Enforced flawlessly)**

### 3. Chaos Failover Benchmark (`bench:chaos`)
* **Configuration**: 3 Consumers, 1 Producer, 1,000 Jobs. Random worker process crashes mid-execution, event loop blocks (2,000ms), and poison pill exceptions.
* **Double Executions**: **0** (Absolute lock safety verified!)
* **DLQ Poison Pills Isolated**: **10**
* **Status**: **✅ PASSED**

### 4. Endurance Soak Benchmark (`bench:endurance`)
* **Configuration**: 2 Consumers processing continuously for 20 seconds.
* **Worker 0 Heap Delta**: **+2.87 MB**
* **Worker 1 Heap Delta**: **-2.29 MB**
* **Status**: **✅ STABLE (No leaks detected)**

---

## 🛠️ Key Architectural Highlights

### 1. Noisy-Neighbor Mitigation (Glob Concurrency)
Message queues often suffer from a single tenant enqueuing millions of tasks and starving other tenants. `@voltrix/mq` allows producers to enqueue messages with a simple `groupId` (e.g. `tenant.heavy.a`), while workers manage concurrency policies centrally using wildcard patterns:
```ts
limitsRules: [
  { pattern: 'tenant.heavy.*', limit: 1 },  // Heavy tenants restricted to 1 concurrent job
  { pattern: 'tenant.light.*', limit: 10 }  // Light tenants allowed to burst up to 10
]
```
These rules are stored in a ZSET sorted by length, ensuring the **longest/most-specific matches always override general patterns**. Coincidences are resolved dynamically in Lua once and cached globally in an $O(1)$ Redis HASH, keeping the hot path blazing fast.

### 2. Reactive Poller Waking
Instead of spinning in a resource-intensive loop or using arbitrary `setTimeout` delays when a poller becomes full, `@voltrix/mq` implements a reactive `fullWakeUpResolver`. The exact microsecond any active job slot completes, it immediately resolves and wakes up the poller to pull the next eligible job, achieving a **22x throughput speedup** (from 127 req/s to **2,999 req/s**).

### 3. Time-Based Lease Fencing
If a consumer process stalls or freezes (e.g., event loop blocking due to synchronous work or GC pauses), its lease will expire in Redis, allowing another worker to sweep and recover the job. To prevent concurrent double-executions once the original worker unblocks, we implement time-based lease fencing. The job synchronously tracks the timestamp of the last successful heartbeat renewal in `Job.isAborted()`. If `Date.now() - lastHeartbeatTime > lockDuration`, it instantly aborts and throws a fence exception before executing any further processing.

### 4. Poison Pill Isolation (DLQ)
When a job crashes a worker process mid-execution repeatedly, it is swept and re-queued. After exceeding `maxStalledCount` (default: 3), the stalled supervisor atomically moves the job directly to the Dead-Letter Queue (DLQ), ensuring crash-loops are safely isolated and do not degrade the worker pool.

---

## 📦 Getting Started

### Installation

```bash
pnpm install @voltrix/mq
```

### 1. Programmatic Producer & Consumer

```ts
import { Queue, Worker } from '@voltrix/mq';

const REDIS_CONFIG = { host: '127.0.0.1', port: 6379 };

// 1. Initialize Queue Producer
const queue = new Queue('reports-queue', REDIS_CONFIG);
await queue.connect();

// Push jobs under different tenant groups
await queue.add('generate', { reportId: '101' }, { groupId: 'tenant.heavy.alpha' });
await queue.add('generate', { reportId: '102' }, { groupId: 'tenant.light.beta' });

// 2. Initialize Worker Consumer
const handler = async (job) => {
  console.log(`Processing job ${job.id} for ${job.group}...`);
  await job.updateProgress(50); // Updates progress dynamically in Redis
  return { fileUrl: `https://s3.amazonaws.com/reports/${job.data.reportId}.pdf` };
};

const worker = new Worker('reports-queue', handler, REDIS_CONFIG, {
  concurrency: 5, // Global worker concurrency cap
  limitsRules: [
    { pattern: 'tenant.heavy.*', limit: 1 },
    { pattern: 'tenant.light.*', limit: 5 },
    { pattern: '*', limit: 1 } // Fallback limit per group
  ]
});

// Event listeners
worker.on('active', (job) => console.log(`Job ${job.id} active`));
worker.on('completed', (job, result) => console.log(`Job ${job.id} done:`, result));
worker.on('failed', (job, err) => console.error(`Job ${job.id} failed:`, err.message));

await worker.start();
```

---

## 📦 Batch Operations & Batch Handlers

`@voltrix/mq` supports ultra-high-throughput batch processing at both the database level (pipelining) and application level (batch worker execution):

### 1. Bulk Job Enqueuing (`addBulk`)
To push thousands of jobs in a single, atomic network flight:
```ts
const jobs = [
  { name: 'generate', data: { id: 1 }, opts: { groupId: 'tenant.heavy' } },
  { name: 'generate', data: { id: 2 }, opts: { groupId: 'tenant.heavy' } },
  { name: 'generate', data: { id: 3 }, opts: { groupId: 'tenant.light' } }
];

const jobIds = await queue.addBulk(jobs);
console.log(`Enqueued ${jobIds.length} jobs in a single round-trip!`);
```

### 2. Batch Worker Mode (`batch: true`)
A Batch Worker pulls a batch of up to `batchSize` (default: `64`) eligible jobs in a single round-trip and forwards the entire array to the handler, enabling batch database inserts, API calls, or bulk processing:
```ts
const batchHandler = async (jobs) => {
  console.log(`Received batch of ${jobs.length} jobs!`);
  
  // Bulk processing (e.g. database batch insert)
  const payloads = jobs.map(j => j.data);
  await db.insertMany(payloads);
  
  // Return values matching jobs array size
  return jobs.map(() => ({ processed: true }));
};

const worker = new Worker('reports-queue', batchHandler, REDIS_CONFIG, {
  batch: true,
  batchSize: 64, // Process up to 64 jobs at once
  limitsRules: [
    { pattern: 'tenant.heavy.*', limit: 5 } // Still strictly respected inside batch acquisition!
  ]
});
await worker.start();
```

---

## 🔌 Decorators & Dependency Injection

`@voltrix/mq` integrates seamlessly with `@voltrix/injector` for declarative queue registering and bootstrap injection:

```ts
import 'reflect-metadata';
import { Queue } from '@voltrix/mq';
import { DIContainer } from '@voltrix/injector';
import { QueueProcessor, Process, InjectQueue, QueueDiscovery } from '@voltrix/mq';

const REDIS_CONFIG = { host: '127.0.0.1', port: 6379 };
const container = new DIContainer();

// 1. Declare a Processor class
@QueueProcessor({
  name: 'billing-queue',
  concurrency: 2
})
class BillingProcessor {
  constructor(
    @InjectQueue('billing-queue') public readonly billingQueue: Queue
  ) {}

  @Process('charge')
  async handleCharge(job) {
    console.log(`Charging customer for job ${job.id}...`);
    return { charged: true };
  }
}

// 2. Bootstrap all processors and queues dynamically
await QueueDiscovery.bootstrap(container, REDIS_CONFIG);

// 3. Inject and use the queue in your app services
const billingQueue = container.resolve<Queue>('Queue:billing-queue');
await billingQueue.add('charge', { amount: 29.99 }, { groupId: 'tenant.heavy.a' });
```

---

## 📊 Traceability & Observability (Trazabilidad)

Every job execution automatically tracks performance diagnostics and carries a permanent correlation ID across cron cycles, yielding full tracing logs stored in the job's hash metadata in Redis:

```json
{
  "correlationId": "my-uuid-correlation-trace-id",
  "transformations": [
    {
      "pluginId": "voltrix:mq",
      "pluginName": "VoltrixMessageQueue",
      "operation": "process:generate",
      "timestamp": 1726053334,
      "performance": {
        "durationMs": 142,
        "cpuUserSec": 0.012
      }
    }
  ]
}
```

---

## 🧪 Testing and Benchmarks

Run the complete integration and benchmark suite against local Redis:

```bash
# Run unit and integration tests (passes 100% green in ~4s)
pnpm run test

# Run performance benchmark (100k jobs)
pnpm run bench:perf

# Run concurrency rules benchmark (Limits Rules)
pnpm run bench:limits

# Run chaos failover benchmark (process crashes, loop blocks)
pnpm run bench:chaos

# Run endurance soak benchmark (stable memory heap soak)
pnpm run bench:endurance
```

---

## 📜 License

MIT
