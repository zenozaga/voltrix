import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Redis } from 'ioredis';
import { Queue } from '../src/core/queue.js';
import { Worker } from '../src/core/worker.js';
import { Job } from '../src/core/job.js';

const __filename = fileURLToPath(import.meta.url);
const REDIS_CONFIG = { host: '127.0.0.1', port: 6379 };
const TOTAL_JOBS = 10000; // 10k jobs per configuration
const CONCURRENCY_PER_WORKER = 5000; // 5000 * 4 = 20000 concurrency total
const NUM_WORKERS = 4;

if (!process.env.ROLE) {
  // ─── COORDINATOR ROLE ───────────────────────────────────────────────────────
  async function runCoordinator() {
    console.log('🏁 Starting Matrix Performance Benchmark (10k Jobs, 5k Concurrency)...');

    const results: any[] = [];

    // Run the 4 configurations sequentially
    const configs = [
      { prodMode: 'single', workerMode: 'single', name: 'Single Enqueue ➔ Single Worker (Baseline)' },
      { prodMode: 'bulk', workerMode: 'single', name: 'Bulk Enqueue ➔ Single Worker' },
      { prodMode: 'single', workerMode: 'batch', name: 'Single Enqueue ➔ Batch Worker' },
      { prodMode: 'bulk', workerMode: 'batch', name: 'Bulk Enqueue ➔ Batch Worker (Optimal)' }
    ];

    for (const config of configs) {
      console.log(`\n------------------------------------------------------`);
      console.log(`🚀 Running: ${config.name}`);
      console.log(`------------------------------------------------------`);
      
      const stats = await runConfig(config.prodMode as any, config.workerMode as any);
      results.push({ ...config, ...stats });
      
      // Wait to cool down Redis and connection pool
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // Print final beautiful matrix table
    console.log('\n===================================================================================================');
    console.log('🏎️  MATRIX PERFORMANCE RESULTS (10k Jobs, 5k Concurrency)');
    console.log('===================================================================================================');
    console.log(
      String('Scenario').padEnd(46) + ' | ' +
      String('Produce T (s)').padStart(13) + ' | ' +
      String('Produce Rate').padStart(14) + ' | ' +
      String('Consume T (s)').padStart(13) + ' | ' +
      String('Consume Rate').padStart(14)
    );
    console.log('-'.repeat(110));
    for (const r of results) {
      const prodRate = `${(TOTAL_JOBS / r.prodDuration).toFixed(0)} j/s`;
      const consRate = `${(TOTAL_JOBS / r.consDuration).toFixed(0)} j/s`;
      console.log(
        r.name.padEnd(46) + ' | ' +
        r.prodDuration.toFixed(3).padStart(13) + ' | ' +
        prodRate.padStart(14) + ' | ' +
        r.consDuration.toFixed(3).padStart(13) + ' | ' +
        consRate.padStart(14)
      );
    }
    console.log('===================================================================================================\n');

    process.exit(0);
  }

  async function runConfig(prodMode: 'single' | 'bulk', workerMode: 'single' | 'batch') {
    const redis = new Redis(REDIS_CONFIG);
    await redis.flushdb();

    const workers: any[] = [];
    let readyWorkers = 0;
    let producer: any = null;

    const promise = new Promise<{ prodDuration: number; consDuration: number }>(async (resolve, reject) => {
      const monitorRedis = new Redis(REDIS_CONFIG);
      const queue = new Queue('perf-bench-queue', monitorRedis);

      let prodStartTime = 0;
      let prodEndTime = 0;
      let consStartTime = 0;
      let interval: NodeJS.Timeout | undefined;

      const cleanup = async () => {
        if (interval) clearInterval(interval);
        if (producer) {
          try { producer.kill(); } catch { }
        }
        for (const w of workers) {
          try { w.kill(); } catch { }
        }
        await monitorRedis.quit();
        await redis.quit();
      };

      const safetyTimeout = setTimeout(async () => {
        console.log(`\n🚨 SAFETY TIMEOUT EXCEEDED in ${prodMode} / ${workerMode} mode!`);
        await cleanup();
        reject(new Error('Timeout'));
      }, 60000);

      const checkProgress = async () => {
        try {
          const metrics = await queue.getMetrics();
          const processed = metrics.completed + metrics.failed;
          const pct = ((processed / TOTAL_JOBS) * 100).toFixed(1);
          console.log(`   [CONSUMING] Progress: ${processed}/${TOTAL_JOBS} jobs (${pct}%) — Active: ${metrics.active}`);

          if (processed >= TOTAL_JOBS) {
            clearTimeout(safetyTimeout);
            const consDuration = (Date.now() - consStartTime) / 1000;
            const prodDuration = (prodEndTime - prodStartTime) / 1000;
            await cleanup();
            resolve({ prodDuration, consDuration });
          }
        } catch (err) {
          // Ignore connection closure errors
        }
      };

      const spawnProducer = () => {
        prodStartTime = Date.now();
        producer = fork(__filename, [], {
          env: { ...process.env, ROLE: 'producer', PRODUCER_MODE: prodMode }
        });
        return producer;
      };

      const spawnWorkers = () => {
        consStartTime = Date.now();
        for (let i = 0; i < NUM_WORKERS; i++) {
          const worker = fork(__filename, [], {
            env: { ...process.env, ROLE: 'consumer', WORKER_MODE: workerMode, WORKER_INDEX: String(i) }
          });
          workers.push(worker);

          worker.on('message', (msg: any) => {
            if (msg.ready) {
              readyWorkers++;
              if (readyWorkers === NUM_WORKERS) {
                interval = setInterval(checkProgress, 100);
              }
            }
          });
        }
      };

      console.log(`   [PRODUCING] Enqueuing 10k jobs using ${prodMode} mode...`);
      const p = spawnProducer();
      p.on('message', (msg: any) => {
        if (msg.done) {
          prodEndTime = Date.now();
          const prodDur = (prodEndTime - prodStartTime) / 1000;
          console.log(`   [PRODUCING] Enqueued 10k jobs in ${prodDur.toFixed(3)}s (${(TOTAL_JOBS / prodDur).toFixed(0)} j/s).`);
          console.log('   [CONSUMING] Starting consumer workers...');
          spawnWorkers();
        }
      });
    });

    return promise;
  }

  runCoordinator();
} else if (process.env.ROLE === 'producer') {
  // ─── PRODUCER ROLE ──────────────────────────────────────────────────────────
  async function runProducer() {
    const queue = new Queue('perf-bench-queue', REDIS_CONFIG);
    await queue.connect();

    const mode = process.env.PRODUCER_MODE || 'single';
    const batchSize = 1000;

    if (mode === 'bulk') {
      for (let i = 0; i < TOTAL_JOBS; i += batchSize) {
        const jobsToPush = [];
        for (let j = 0; j < batchSize && (i + j) < TOTAL_JOBS; j++) {
          const jobId = i + j;
          const tenant = `tenant-${jobId % 5}`;
          jobsToPush.push({
            name: `task-${jobId}`,
            data: { num: jobId },
            opts: { groupId: tenant, removeOnComplete: false }
          });
        }
        await queue.addBulk(jobsToPush);
      }
    } else {
      for (let i = 0; i < TOTAL_JOBS; i += batchSize) {
        const promises: Promise<string>[] = [];
        for (let j = 0; j < batchSize && (i + j) < TOTAL_JOBS; j++) {
          const jobId = i + j;
          const tenant = `tenant-${jobId % 5}`;
          promises.push(
            queue.add(`task-${jobId}`, { num: jobId }, { groupId: tenant, removeOnComplete: false })
          );
        }
        await Promise.all(promises);
      }
    }

    await queue.close();
    process.send!({ done: true });
  }

  runProducer();
} else if (process.env.ROLE === 'consumer') {
  // ─── CONSUMER ROLE ──────────────────────────────────────────────────────────
  async function runConsumer() {
    const handler = async (jobsOrJob: any) => {
      // Simulate light async process
      await new Promise((resolve) => setTimeout(resolve, 1));
      if (Array.isArray(jobsOrJob)) {
        return jobsOrJob.map(() => ({ ok: true }));
      }
      return { ok: true };
    };

    const isBatch = process.env.WORKER_MODE === 'batch';
    const worker = new Worker('perf-bench-queue', handler, REDIS_CONFIG, {
      concurrency: CONCURRENCY_PER_WORKER,
      batch: isBatch,
      batchSize: isBatch ? 64 : 1
    });
    await worker.start();

    process.send!({ ready: true });
  }

  runConsumer();
}
