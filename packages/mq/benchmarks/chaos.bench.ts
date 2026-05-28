import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Redis } from 'ioredis';
import { Queue } from '../src/core/queue.js';
import { Worker } from '../src/core/worker.js';
import { Job } from '../src/core/job.js';

const __filename = fileURLToPath(import.meta.url);
const REDIS_CONFIG = { host: '127.0.0.1', port: 6379 };
const TOTAL_JOBS = 1000;
const LOCK_DURATION = 1500; // Short lock to test lease fencing quickly

if (!process.env.ROLE) {
  // ─── COORDINATOR ROLE ───────────────────────────────────────────────────────
  async function runCoordinator() {
    console.log('🏁 Starting Chaos failover benchmark...');
    const redis = new Redis(REDIS_CONFIG);
    await redis.flushdb();
    await redis.quit();

    const workers: Map<number, any> = new Map();
    let readyWorkers = 0;
    let producer: any = null;

    // Track active jobs per worker to prevent false-positives when a worker is killed
    const workerActiveJobs = new Map<number, Map<string, number>>();
    const doubleExecutions = new Set<string>();

    for (let i = 0; i < 3; i++) {
      workerActiveJobs.set(i, new Map());
    }

    const spawnWorker = (index: number) => {
      const child = fork(__filename, [], {
        env: { ...process.env, ROLE: 'consumer', WORKER_INDEX: String(index) }
      });

      child.on('message', (msg: any) => {
        if (msg.ready) {
          readyWorkers++;
          if (readyWorkers === 3 && !producer) {
            console.log('📡 Workers ready. Spawning producer...');
            producer = fork(__filename, [], { env: { ...process.env, ROLE: 'producer' } });
          }
        }
        if (msg.acquire) {
          const wIdx = Number(msg.workerIndex ?? 0);
          const now = Date.now();
          
          // Check if ANY OTHER worker is currently processing this job and has a valid lease
          let otherWorkerExecuting = false;
          for (const [idx, jobsMap] of workerActiveJobs.entries()) {
            if (idx !== wIdx && jobsMap.has(msg.acquire)) {
              const acquireTime = jobsMap.get(msg.acquire)!;
              const elapsed = now - acquireTime;
              if (elapsed <= LOCK_DURATION) {
                otherWorkerExecuting = true;
                break;
              }
            }
          }
          
          if (otherWorkerExecuting) {
            doubleExecutions.add(msg.acquire);
            console.log(`⚠️  CRITICAL: Job ${msg.acquire} is being double-executed concurrently!`);
          }
          
          workerActiveJobs.get(wIdx)!.set(msg.acquire, now);
        }
        if (msg.release) {
          const wIdx = Number(msg.workerIndex ?? 0);
          workerActiveJobs.get(wIdx)!.delete(msg.release);
        }
      });

      workers.set(index, child);
      return child;
    };

    // Spawn 3 workers initially
    for (let i = 0; i < 3; i++) {
      spawnWorker(i);
    }

    // Chaotic failure loops
    const chaosInterval = setInterval(() => {
      // 1. Random Worker Kill & Restart
      const victimIndex = Math.floor(Math.random() * 3);
      const victim = workers.get(victimIndex);
      if (victim) {
        console.log(`💥 Chaos: Killing Worker ${victimIndex} mid-execution...`);
        // Clean up the dead worker's active jobs since it was killed and can't send release
        workerActiveJobs.get(victimIndex)!.clear();
        
        victim.kill();
        readyWorkers--;
        setTimeout(() => {
          console.log(`♻️  Chaos: Resurrecting Worker ${victimIndex}...`);
          spawnWorker(victimIndex);
        }, 500);
      }

      // 2. Event loop sleep-block trigger (lease fencing check)
      const targetIndex = Math.floor(Math.random() * 3);
      const target = workers.get(targetIndex);
      if (target && target.connected) {
        console.log(`⏳ Chaos: Signaling Worker ${targetIndex} to block its Event Loop (forces lock expiration)...`);
        target.send({ block: true });
      }
    }, 2000);

    const monitorRedis = new Redis(REDIS_CONFIG);
    const queue = new Queue('chaos-bench-queue', monitorRedis);

    // Safety Timeout Watchdog: 45 seconds max duration
    const safetyTimeout = setTimeout(async () => {
      console.log('\n🚨 SAFETY WATCHDOG TIMEOUT EXCEEDED: Chaos benchmark took too long!');
      console.log('Force-terminating all processes and exiting safely...');
      clearInterval(chaosInterval);
      clearInterval(progressInterval);
      if (producer) producer.kill();
      for (const w of workers.values()) w.kill();
      await monitorRedis.quit();
      process.exit(1);
    }, 45000);

    const progressInterval = setInterval(async () => {
      const metrics = await queue.getMetrics();
      const processed = metrics.completed + metrics.failed;
      console.log(`📊 Progress: ${processed}/${TOTAL_JOBS} (DLQ: ${metrics.dlq}, Active: ${metrics.active})`);

      if (processed >= TOTAL_JOBS) {
        clearTimeout(safetyTimeout);
        clearInterval(chaosInterval);
        clearInterval(progressInterval);

        console.log('\n======================================================');
        console.log('⚡  CHAOS FAILOVER BENCHMARK RESULTS');
        console.log('======================================================');
        console.log(`Total Jobs Processed : ${processed}`);
        console.log(`Dead-Letter Queue    : ${metrics.dlq}`);
        console.log(`Double Executions    : ${doubleExecutions.size} (Expected: 0)`);
        console.log(`Failures Survived    : Workers killed/restarted, lock expirations`);
        console.log('======================================================\n');

        // Cleanup
        if (producer) producer.kill();
        for (const w of workers.values()) w.kill();
        await monitorRedis.quit();
        process.exit(doubleExecutions.size === 0 ? 0 : 1);
      }
    }, 1000);
  }

  runCoordinator();
} else if (process.env.ROLE === 'producer') {
  // ─── PRODUCER ROLE ──────────────────────────────────────────────────────────
  async function runProducer() {
    const queue = new Queue('chaos-bench-queue', REDIS_CONFIG);
    await queue.connect();

    // Push half good jobs, some poison pills (bad formatting to trigger exceptions)
    for (let i = 0; i < TOTAL_JOBS; i++) {
      const tenant = `tenant-${i % 3}`;
      const isPoison = i % 100 === 0; // 1% poison pills
      await queue.add(
        `task-${i}`,
        { num: i, poison: isPoison },
        { groupId: tenant, attempts: 2, removeOnComplete: false, removeOnFail: false }
      );
    }

    await queue.close();
  }

  runProducer();
} else if (process.env.ROLE === 'consumer') {
  // ─── CONSUMER ROLE ──────────────────────────────────────────────────────────
  async function runConsumer() {
    const wIndex = Number(process.env.WORKER_INDEX || '0');
    let blockFlag = false;

    process.on('message', (msg: any) => {
      if (msg.block) {
        blockFlag = true;
      }
    });

    const handler = async (job: Job) => {
      process.send!({ acquire: job.id, workerIndex: wIndex });

      try {
        if (job.data.poison) {
          throw new Error('Poison pill triggered exception');
        }

        // Simulate loop block if chaos coordinator ordered it
        if (blockFlag) {
          blockFlag = false;
          console.log(`   [Worker ${wIndex}] Event Loop Blocked...`);
          const blockUntil = Date.now() + 2000;
          while (Date.now() < blockUntil) {
            // Synchronous CPU blocking
          }
          console.log(`   [Worker ${wIndex}] Event Loop Unblocked.`);
        }

        // Simulate some processing duration
        await new Promise((resolve) => setTimeout(resolve, 5));

        if (job.isAborted()) {
          console.log(`🛡️  Lease Fence: Worker ${wIndex} aborted execution for job ${job.id}`);
          throw new Error('Aborted by lease fence');
        }

        return { ok: true };
      } finally {
        process.send!({ release: job.id, workerIndex: wIndex });
      }
    };

    const worker = new Worker('chaos-bench-queue', handler, REDIS_CONFIG, {
      concurrency: 5,
      workerConcurrency: 5,
      lockDuration: LOCK_DURATION,
      stalledInterval: 1000
    });
    await worker.start();

    process.send!({ ready: true });
  }

  runConsumer();
}
