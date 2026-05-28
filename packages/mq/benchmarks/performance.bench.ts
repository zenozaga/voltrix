import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Redis } from 'ioredis';
import { Queue } from '../src/core/queue.js';
import { Worker } from '../src/core/worker.js';
import { Job } from '../src/core/job.js';

const __filename = fileURLToPath(import.meta.url);
const REDIS_CONFIG = { host: '127.0.0.1', port: 6379 };
const TOTAL_JOBS = 10000; // 10k jobs per mode
const CONCURRENCY_PER_WORKER = 1250; // 1250 * 4 = 5000 (5k concurrency total)
const NUM_WORKERS = 4;

if (!process.env.ROLE) {
  // ─── COORDINATOR ROLE ───────────────────────────────────────────────────────
  async function runCoordinator() {
    console.log('🏁 Starting Dual-Mode Performance Benchmark (10k Jobs, 5k Concurrency)...');
    
    // 1. Run Pub/Sub Mode
    console.log('\n🔵 Running Mode 1: Pub/Sub (Publish and Consume simultaneously)...');
    const statsPubSub = await runMode('pubsub');

    // Wait a brief moment for Redis to cool down
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 2. Run Replay Mode
    console.log('\n🔴 Running Mode 2: Replay (Publish all first, then Consume)...');
    const statsReplay = await runMode('replay');

    // 3. Display Comparison
    console.log('\n======================================================');
    console.log('🏎️  PERFORMANCE COMPARISON RESULTS (10k Jobs, 5k Concurrency)');
    console.log('======================================================');
    
    const printRow = (modeName: string, stats: any) => {
      console.log(`📊 Mode: ${modeName}`);
      console.log(`   Total Duration : ${stats.duration.toFixed(2)} seconds`);
      console.log(`   Throughput Rate: ${stats.throughput} jobs/sec`);
      console.log('------------------------------------------------------');
    };

    printRow('PUB/SUB (Simultaneous)', statsPubSub);
    printRow('REPLAY (Queue Spooling)', statsReplay);
    
    const ratio = (statsReplay.throughput / statsPubSub.throughput).toFixed(2);
    console.log(`💡 Replay Mode is ${ratio}x as fast as Pub/Sub Mode.`);
    console.log('======================================================\n');
    
    process.exit(0);
  }

  async function runMode(mode: 'pubsub' | 'replay') {
    const redis = new Redis(REDIS_CONFIG);
    await redis.flushdb();

    const workers: any[] = [];
    let readyWorkers = 0;
    let producer: any = null;

    const promise = new Promise<{ duration: number; throughput: number }>(async (resolve, reject) => {
      const monitorRedis = new Redis(REDIS_CONFIG);
      const queue = new Queue('perf-bench-queue', monitorRedis);

      let startTime = 0;
      let interval: NodeJS.Timeout | undefined;

      const cleanup = async () => {
        if (interval) clearInterval(interval);
        if (producer) {
          try { producer.kill(); } catch {}
        }
        for (const w of workers) {
          try { w.kill(); } catch {}
        }
        await monitorRedis.quit();
        await redis.quit();
      };

      const safetyTimeout = setTimeout(async () => {
        console.log(`\n🚨 SAFETY TIMEOUT EXCEEDED in ${mode} mode!`);
        await cleanup();
        reject(new Error('Timeout'));
      }, 45000);

      const checkProgress = async () => {
        try {
          const metrics = await queue.getMetrics();
          const processed = metrics.completed + metrics.failed;
          const pct = ((processed / TOTAL_JOBS) * 100).toFixed(1);
          console.log(`   [${mode.toUpperCase()}] Progress: ${processed}/${TOTAL_JOBS} jobs (${pct}%) — Active: ${metrics.active}`);

          if (processed >= TOTAL_JOBS) {
            clearTimeout(safetyTimeout);
            const duration = (Date.now() - startTime) / 1000;
            const throughput = Number((TOTAL_JOBS / duration).toFixed(0));
            await cleanup();
            resolve({ duration, throughput });
          }
        } catch (err) {
          // Ignore transient connection errors during shutdown
        }
      };

      const spawnProducer = () => {
        producer = fork(__filename, [], { env: { ...process.env, ROLE: 'producer', MODE: mode } });
        return producer;
      };

      const spawnWorkers = () => {
        startTime = Date.now();
        for (let i = 0; i < NUM_WORKERS; i++) {
          const worker = fork(__filename, [], {
            env: { ...process.env, ROLE: 'consumer', MODE: mode, WORKER_INDEX: String(i) }
          });
          workers.push(worker);

          worker.on('message', (msg: any) => {
            if (msg.ready) {
              readyWorkers++;
              if (readyWorkers === NUM_WORKERS) {
                interval = setInterval(checkProgress, 250);
              }
            }
          });
        }
      };

      if (mode === 'pubsub') {
        spawnWorkers();
        
        const checkReady = setInterval(() => {
          if (readyWorkers === NUM_WORKERS) {
            clearInterval(checkReady);
            spawnProducer();
          }
        }, 20);
      } else {
        console.log('   Enqueuing all 10k jobs to Redis first...');
        const p = spawnProducer();
        p.on('message', (msg: any) => {
          if (msg.done) {
            console.log('   All jobs enqueued. Starting consumer workers...');
            spawnWorkers();
          }
        });
      }
    });

    return promise;
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
        const tenant = `tenant-${jobId % 5}`;
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
