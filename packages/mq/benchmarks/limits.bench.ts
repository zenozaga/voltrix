import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Redis } from 'ioredis';
import { Queue } from '../src/core/queue.js';
import { Worker } from '../src/core/worker.js';
import { Job } from '../src/core/job.js';

const __filename = fileURLToPath(import.meta.url);
const REDIS_CONFIG = { host: '127.0.0.1', port: 6379 };
const TOTAL_JOBS = 30; // 10 Heavy, 10 Light, 10 Fallback

if (!process.env.ROLE) {
  // ─── COORDINATOR ROLE ───────────────────────────────────────────────────────
  async function runCoordinator() {
    console.log('🏁 Starting Group Concurrency Limits Rules benchmark...');
    const redis = new Redis(REDIS_CONFIG);
    await redis.flushdb();
    await redis.quit();

    const workers: any[] = [];
    let readyWorkers = 0;
    let producer: any = null;

    // Track active jobs per group
    const activePerGroup = new Map<string, Set<string>>();
    const maxActivePerGroup = new Map<string, number>();
    const groupStartTimes = new Map<string, number>();
    const groupEndTimes = new Map<string, number>();
    const completedPerGroup = new Map<string, number>();

    const spawnProcess = (role: string, index?: number) => {
      const child = fork(__filename, [], {
        env: { ...process.env, ROLE: role, WORKER_INDEX: String(index ?? 0) }
      });
      return child;
    };

    // Spawn 2 workers
    for (let i = 0; i < 2; i++) {
      const worker = spawnProcess('consumer', i);
      workers.push(worker);

      worker.on('message', (msg: any) => {
        if (msg.ready) {
          readyWorkers++;
          if (readyWorkers === 2) {
            console.log('📡 Workers ready. Spawning producer...');
            producer = spawnProcess('producer');
          }
        }
        if (msg.acquire) {
          const { jobId, groupId } = msg;
          
          if (!groupStartTimes.has(groupId)) {
            groupStartTimes.set(groupId, Date.now());
          }

          if (!activePerGroup.has(groupId)) {
            activePerGroup.set(groupId, new Set());
          }
          activePerGroup.get(groupId)!.add(jobId);
          
          const currentActive = activePerGroup.get(groupId)!.size;
          const maxSoFar = maxActivePerGroup.get(groupId) || 0;
          if (currentActive > maxSoFar) {
            maxActivePerGroup.set(groupId, currentActive);
          }
        }
        if (msg.release) {
          const { jobId, groupId } = msg;
          if (activePerGroup.has(groupId)) {
            activePerGroup.get(groupId)!.delete(jobId);
          }

          const completedCount = (completedPerGroup.get(groupId) || 0) + 1;
          completedPerGroup.set(groupId, completedCount);

          if (completedCount === 10) {
            groupEndTimes.set(groupId, Date.now());
          }
        }
      });
    }

    const monitorRedis = new Redis(REDIS_CONFIG);
    const queue = new Queue('limits-bench-queue', monitorRedis);

    // Safety Timeout Watchdog: 25 seconds max duration
    const safetyTimeout = setTimeout(async () => {
      console.log('\n🚨 SAFETY WATCHDOG TIMEOUT EXCEEDED: Limits benchmark took too long!');
      if (producer) producer.kill();
      for (const w of workers) w.kill();
      await monitorRedis.quit();
      process.exit(1);
    }, 25000);

    const progressInterval = setInterval(async () => {
      const metrics = await queue.getMetrics();
      const processed = metrics.completed + metrics.failed;
      console.log(`📊 Progress: ${processed}/${TOTAL_JOBS} (Active: ${metrics.active})`);

      if (processed >= TOTAL_JOBS) {
        clearTimeout(safetyTimeout);
        clearInterval(progressInterval);

        console.log('\n======================================================');
        console.log('🛡️  REAL-WORLD GROUP CONCURRENCY LIMITS BENCHMARK');
        console.log('======================================================');
        
        const printGroupStats = (groupId: string, expectedLimit: number, description: string) => {
          const maxConcurrency = maxActivePerGroup.get(groupId) || 0;
          const start = groupStartTimes.get(groupId) || 0;
          const end = groupEndTimes.get(groupId) || 0;
          const durationSec = (end - start) / 1000;
          const throughput = durationSec > 0 ? (10 / durationSec).toFixed(2) : '0.00';
          
          console.log(`📊 [${groupId}] - ${description}`);
          console.log(`   Configured Limit    : ${expectedLimit}`);
          console.log(`   Max Concurrency Met : ${maxConcurrency} active`);
          console.log(`   Total Duration      : ${durationSec.toFixed(3)} seconds`);
          console.log(`   Measured Throughput : ${throughput} jobs/sec`);
          console.log('------------------------------------------------------');
        };

        printGroupStats('tenant.heavy.a', 1, 'Heavy pattern group (tenant.heavy.*)');
        printGroupStats('tenant.light.b', 10, 'Light pattern group (tenant.light.*)');
        printGroupStats('tenant.fallback.c', 1, 'Fallback wildcard group (*)');
        
        const maxHeavy = maxActivePerGroup.get('tenant.heavy.a') || 0;
        const maxLight = maxActivePerGroup.get('tenant.light.b') || 0;
        const maxFallback = maxActivePerGroup.get('tenant.fallback.c') || 0;

        let success = true;
        if (maxHeavy > 1) {
          console.log('❌ Failure: tenant.heavy.a exceeded its concurrency cap of 1!');
          success = false;
        } else {
          console.log('✅ Success: tenant.heavy.a perfectly respected its concurrency limit.');
        }

        if (maxFallback > 1) {
          console.log('❌ Failure: tenant.fallback.c exceeded its wildcard concurrency cap of 1!');
          success = false;
        } else {
          console.log('✅ Success: tenant.fallback.c perfectly respected fallback concurrency.');
        }

        if (maxLight <= 1) {
          console.log('⚠️  Warning: tenant.light.b did not execute concurrently (processed sequentially).');
          success = false;
        } else {
          console.log('✅ Success: tenant.light.b processed concurrently as allowed by its limits rule.');
        }

        console.log('======================================================\n');

        // Cleanup
        if (producer) producer.kill();
        for (const w of workers) w.kill();
        await monitorRedis.quit();
        process.exit(success ? 0 : 1);
      }
    }, 500);

  }

  runCoordinator();
} else if (process.env.ROLE === 'producer') {
  // ─── PRODUCER ROLE ──────────────────────────────────────────────────────────
  async function runProducer() {
    const queue = new Queue('limits-bench-queue', REDIS_CONFIG);
    await queue.connect();

    // Push 10 heavy jobs (concurrency limit = 1)
    for (let i = 0; i < 10; i++) {
      await queue.add(`heavy-${i}`, { delay: 100 }, { groupId: 'tenant.heavy.a', removeOnComplete: false });
    }

    // Push 10 light jobs (concurrency limit = 10)
    for (let i = 0; i < 10; i++) {
      await queue.add(`light-${i}`, { delay: 100 }, { groupId: 'tenant.light.b', removeOnComplete: false });
    }

    // Push 10 fallback jobs (matches wildcard limit = 1)
    for (let i = 0; i < 10; i++) {
      await queue.add(`fallback-${i}`, { delay: 100 }, { groupId: 'tenant.fallback.c', removeOnComplete: false });
    }

    await queue.close();
  }

  runProducer();
} else if (process.env.ROLE === 'consumer') {
  // ─── CONSUMER ROLE ──────────────────────────────────────────────────────────
  async function runConsumer() {
    const handler = async (job: Job) => {
      process.send!({ acquire: true, jobId: job.id, groupId: job.group });

      // Simulate a CPU / network task taking 100ms
      const delay = job.data.delay || 100;
      await new Promise((resolve) => setTimeout(resolve, delay));

      process.send!({ release: true, jobId: job.id, groupId: job.group });
      return { ok: true };
    };

    const worker = new Worker('limits-bench-queue', handler, REDIS_CONFIG, {
      concurrency: 20, // Global worker concurrency cap
      limitsRules: [
        { pattern: 'tenant.heavy.*', limit: 1 },
        { pattern: 'tenant.light.*', limit: 10 },
        { pattern: '*', limit: 1 } // Fallback limit per group
      ]
    });
    await worker.start();

    process.send!({ ready: true });
  }

  runConsumer();
}
