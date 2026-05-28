import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Redis } from 'ioredis';
import { Queue } from '../src/core/queue.js';
import { Worker } from '../src/core/worker.js';
import { Job } from '../src/core/job.js';

const __filename = fileURLToPath(import.meta.url);
const REDIS_CONFIG = { host: '127.0.0.1', port: 6379 };
const DURATION_MS = 20000; // 20 seconds soak run

if (!process.env.ROLE) {
  // ─── COORDINATOR ROLE ───────────────────────────────────────────────────────
  async function runCoordinator() {
    console.log('🏁 Starting Endurance & Soak Benchmark...');
    const redis = new Redis(REDIS_CONFIG);
    await redis.flushdb();
    await redis.quit();

    const workers: any[] = [];
    let producer: any = null;
    let readyWorkers = 0;

    const memoryTraces: Map<number, number[]> = new Map();

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
      memoryTraces.set(i, []);

      worker.on('message', (msg: any) => {
        if (msg.ready) {
          readyWorkers++;
          if (readyWorkers === 2) {
            console.log('📡 Workers ready. Spawning producer...');
            producer = spawnProcess('producer');
          }
        }
        if (msg.memory) {
          memoryTraces.get(msg.workerIndex)!.push(msg.memory);
        }
      });
    }

    // Safety Timeout Watchdog: 45 seconds max
    const safetyTimeout = setTimeout(async () => {
      console.log('\n🚨 SAFETY WATCHDOG TIMEOUT EXCEEDED: Endurance benchmark took too long!');
      console.log('Force-terminating all processes and exiting safely...');
      if (producer) producer.kill();
      for (const w of workers) w.kill();
      process.exit(1);
    }, 45000);

    // Run for DURATION_MS
    setTimeout(async () => {
      clearTimeout(safetyTimeout);
      console.log('⏳ Endurance period finished. Analysing profiles...');

      // Cleanup
      producer.kill();
      for (const w of workers) w.kill();

      console.log('\n======================================================');
      console.log('⏳  ENDURANCE & SOAK SOAK BENCHMARK RESULTS');
      console.log('======================================================');
      
      let leakDetected = false;

      for (const [wIdx, trace] of memoryTraces.entries()) {
        const first = trace[0] || 0;
        const last = trace[trace.length - 1] || 0;
        const deltaMb = ((last - first) / 1024 / 1024).toFixed(2);
        
        console.log(`Worker ${wIdx} Heap Profile:`);
        console.log(`  Initial Heap   : ${(first / 1024 / 1024).toFixed(2)} MB`);
        console.log(`  Final Heap     : ${(last / 1024 / 1024).toFixed(2)} MB`);
        console.log(`  Heap Delta     : ${deltaMb} MB`);

        // If heap grew by more than 15MB continuously, flag as potential leak
        if ((last - first) > 15 * 1024 * 1024) {
          leakDetected = true;
        }
      }

      console.log('------------------------------------------------------');
      console.log(`Memory Leak Status   : ${leakDetected ? '⚠️  POTENTIAL LEAK' : '✅ STABLE (No leaks)'}`);
      console.log('======================================================\n');

      process.exit(leakDetected ? 1 : 0);
    }, DURATION_MS);
  }

  runCoordinator();
} else if (process.env.ROLE === 'producer') {
  // ─── PRODUCER ROLE ──────────────────────────────────────────────────────────
  async function runProducer() {
    const queue = new Queue('endurance-bench-queue', REDIS_CONFIG);
    await queue.connect();

    let jobIndex = 0;
    const batchPush = async () => {
      const promises: Promise<string>[] = [];
      for (let i = 0; i < 200; i++) {
        promises.push(
          queue.add(`endurance-${jobIndex++}`, { random: Math.random() }, { groupId: 'tenant-1' })
        );
      }
      await Promise.all(promises);
      
      // Schedule next batch
      setTimeout(batchPush, 100);
    };

    batchPush();
  }

  runProducer();
} else if (process.env.ROLE === 'consumer') {
  // ─── CONSUMER ROLE ──────────────────────────────────────────────────────────
  async function runConsumer() {
    const wIndex = Number(process.env.WORKER_INDEX || '0');

    const handler = async (job: Job) => {
      // Simulate typical object creation
      const data = new Array(100).fill(0).map(() => ({ val: Math.random() }));
      return { ok: true, data };
    };

    const worker = new Worker('endurance-bench-queue', handler, REDIS_CONFIG, {
      concurrency: 10
    });
    await worker.start();

    process.send!({ ready: true });

    // Periodically send memory stats back to coordinator
    setInterval(() => {
      // Force GC hints if possible
      if (global && typeof (global as any).gc === 'function') {
        (global as any).gc();
      }
      
      process.send!({
        workerIndex: wIndex,
        memory: process.memoryUsage().heapUsed
      });
    }, 1000);
  }

  runConsumer();
}
