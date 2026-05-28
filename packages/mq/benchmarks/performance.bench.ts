import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Redis } from 'ioredis';
import { Queue } from '../src/core/queue.js';
import { Worker } from '../src/core/worker.js';
import { Job } from '../src/core/job.js';

const __filename = fileURLToPath(import.meta.url);
const REDIS_CONFIG = { host: '127.0.0.1', port: 6379 };
const TOTAL_JOBS = 100000;
const CONCURRENCY_PER_WORKER = 5;
const NUM_WORKERS = 4;

if (!process.env.ROLE) {
  // ─── COORDINATOR ROLE ───────────────────────────────────────────────────────
  async function runCoordinator() {
    console.log('🏁 Starting Performance Benchmark...');
    const redis = new Redis(REDIS_CONFIG);
    await redis.flushdb();
    await redis.quit();

    let readyWorkers = 0;
    const workers: any[] = [];
    let producer: any = null;

    const startTime = Date.now();
    let producerDone = false;

    // Helper to spawn processes
    const spawnProcess = (role: string, index?: number) => {
      const child = fork(__filename, [], {
        env: { ...process.env, ROLE: role, WORKER_INDEX: String(index ?? 0) }
      });
      return child;
    };

    // Spawn Workers
    for (let i = 0; i < NUM_WORKERS; i++) {
      const worker = spawnProcess('consumer', i);
      workers.push(worker);

      worker.on('message', (msg: any) => {
        if (msg.ready) {
          readyWorkers++;
          if (readyWorkers === NUM_WORKERS) {
            console.log(`📡 All ${NUM_WORKERS} workers ready. Spawning producer...`);
            producer = spawnProcess('producer');
            producer.on('message', (pMsg: any) => {
              if (pMsg.done) {
                producerDone = true;
                console.log('📤 Producer finished enqueuing all jobs.');
              }
            });
          }
        }
      });
    }

    // Monitor progress periodically using a Redis client
    const monitorRedis = new Redis(REDIS_CONFIG);
    const queue = new Queue('perf-bench-queue', monitorRedis);
    
    // Safety Timeout Watchdog: 180 seconds max (3 minutes)
    const safetyTimeout = setTimeout(async () => {
      console.log('\n🚨 SAFETY WATCHDOG TIMEOUT EXCEEDED: Performance benchmark took too long!');
      console.log('Force-terminating all processes and exiting safely...');
      clearInterval(interval);
      if (producer) producer.kill();
      for (const w of workers) w.kill();
      await monitorRedis.quit();
      process.exit(1);
    }, 180000);

    const interval = setInterval(async () => {
      const metrics = await queue.getMetrics();
      const processed = metrics.completed + metrics.failed;
      const pct = ((processed / TOTAL_JOBS) * 100).toFixed(1);
      console.log(`📊 Progress: ${processed}/${TOTAL_JOBS} jobs (${pct}%) — Active: ${metrics.active}`);

      if (processed >= TOTAL_JOBS) {
        clearTimeout(safetyTimeout);
        clearInterval(interval);
        const duration = (Date.now() - startTime) / 1000;
        const throughput = (TOTAL_JOBS / duration).toFixed(0);

        console.log('\n======================================================');
        console.log('🏎️  PERFORMANCE BENCHMARK RESULTS');
        console.log('======================================================');
        console.log(`Total Jobs Processed : ${TOTAL_JOBS}`);
        console.log(`Total Duration       : ${duration.toFixed(2)} seconds`);
        console.log(`Throughput Rate      : ${throughput} jobs/sec`);
        console.log(`Multi-Process Config : 1 Producer, ${NUM_WORKERS} Consumers`);
        console.log('======================================================\n');

        // Cleanup
        producer.kill();
        for (const w of workers) w.kill();
        await monitorRedis.quit();
        process.exit(0);
      }
    }, 1000);
  }

  runCoordinator();
} else if (process.env.ROLE === 'producer') {
  // ─── PRODUCER ROLE ──────────────────────────────────────────────────────────
  async function runProducer() {
    const queue = new Queue('perf-bench-queue', REDIS_CONFIG);
    await queue.connect();

    const batchSize = 1000;
    for (let i = 0; i < TOTAL_JOBS; i += batchSize) {
      const promises: Promise<string>[] = [];
      for (let j = 0; j < batchSize && (i + j) < TOTAL_JOBS; j++) {
        const jobId = i + j;
        const tenant = `tenant-${jobId % 5}`; // Rotated group to check group limits rules fallback
        promises.push(
          queue.add(`task-${jobId}`, { num: jobId }, { groupId: tenant, removeOnComplete: false })
        );
      }
      await Promise.all(promises);
    }

    await queue.close();
    process.send!({ done: true });
  }

  runProducer();
} else if (process.env.ROLE === 'consumer') {
  // ─── CONSUMER ROLE ──────────────────────────────────────────────────────────
  async function runConsumer() {
    const handler = async (job: Job) => {
      // Simulate light async process
      await new Promise((resolve) => setTimeout(resolve, 1));
      return { ok: true };
    };

    const worker = new Worker('perf-bench-queue', handler, REDIS_CONFIG, {
      concurrency: CONCURRENCY_PER_WORKER,
      workerConcurrency: CONCURRENCY_PER_WORKER
    });
    await worker.start();

    process.send!({ ready: true });
  }

  runConsumer();
}
