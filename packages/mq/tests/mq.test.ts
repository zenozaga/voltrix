import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Redis } from 'ioredis';
import { Queue } from '../src/core/queue.js';
import { Worker } from '../src/core/worker.js';
import { Job } from '../src/core/job.js';
import { registerCommands } from '../src/core/lua-scripts.js';
import { DIContainer } from '@voltrix/injector';
import { QueueProcessor, Process, InjectQueue, QueueDiscovery, LimitRule } from '../src/decorators/index.js';

const REDIS_CONFIG = { host: '127.0.0.1', port: 6379 };

describe('@voltrix/mq Integration Tests', () => {
  let redis: Redis;

  beforeAll(async () => {
    redis = new Redis(REDIS_CONFIG);
    await redis.ping();
    registerCommands(redis);
  });

  beforeEach(async () => {
    // Flush DB to ensure a clean slate before each test
    await redis.flushdb();
  });

  afterAll(async () => {
    await redis.quit();
  });

  // ─── 1. Programmatic Operations ─────────────────────────────────────────────
  describe('Programmatic Core', () => {
    it('should push, acquire, complete a job and collect metrics', async () => {
      const queueName = 'test-queue-basics';
      const queue = new Queue(queueName, REDIS_CONFIG);
      await queue.connect();

      const workerHandler = async (job: Job) => {
        if (job.name === 'task-1') {
          expect(job.data).toEqual({ foo: 'bar' });
          await job.updateProgress(50);
          return { success: true };
        } else if (job.name === 'task-2') {
          expect(job.data).toEqual({ keep: true });
          return { success: true };
        }
        throw new Error(`Unknown job: ${job.name}`);
      };

      const worker = new Worker(queueName, workerHandler, REDIS_CONFIG, {
        concurrency: 5,
        workerConcurrency: 5,
        lockDuration: 5000,
      });

      // 1. Queue is empty initial metrics
      let metrics = await queue.getMetrics();
      expect(metrics.waiting).toBe(0);
      expect(metrics.active).toBe(0);

      // 2. Add job
      const jobId = await queue.add('task-1', { foo: 'bar' }, { groupId: 'group-1' });
      expect(jobId).toBeDefined();

      metrics = await queue.getMetrics();
      expect(metrics.waiting).toBe(1);

      // Start the worker to begin processing
      await worker.start();

      // Wait a moment for worker to poll and process
      await new Promise<void>((resolve) => {
        const check = setInterval(async () => {
          const m = await queue.getMetrics();
          if (m.waiting === 0 && m.active === 0) {
            clearInterval(check);
            resolve();
          }
        }, 50);
      });

      // 3. Confirm final completed state metrics
      metrics = await queue.getMetrics();
      expect(metrics.waiting).toBe(0);
      expect(metrics.active).toBe(0);

      // By default removeOnComplete is true, so the job hash is cleaned up.
      // Let's verify with a job where removeOnComplete is false
      const jobId2 = await queue.add(
        'task-2',
        { keep: true },
        { groupId: 'group-1', removeOnComplete: false }
      );

      await new Promise<void>((resolve) => {
        const check = setInterval(async () => {
          const m = await queue.getMetrics();
          if (m.completed === 1) {
            clearInterval(check);
            resolve();
          }
        }, 50);
      });

      const finishedJob = await queue.getJob(jobId2);
      expect(finishedJob).not.toBeNull();
      expect(finishedJob?.state).toBe('completed');
      expect(finishedJob?.progress).toBe(0);

      await queue.close();
      await worker.shutdown(1000);
    });

    it('should fail and retry jobs with backoff, then move to DLQ if max attempts reached', async () => {
      const queueName = 'test-queue-fails';
      const queue = new Queue(queueName, REDIS_CONFIG);
      await queue.connect();

      let runCount = 0;
      const workerHandler = async (job: Job) => {
        runCount++;
        throw new Error(`Execution failed ${runCount}`);
      };

      const worker = new Worker(queueName, workerHandler, REDIS_CONFIG, {
        concurrency: 5,
        workerConcurrency: 5,
        lockDuration: 5000,
      });
      await worker.start();

      // Add a job with 2 attempts
      const jobId = await queue.add(
        'fail-task',
        { val: 42 },
        {
          groupId: 'group-1',
          attempts: 2,
          backoff: { type: 'linear', delay: 10 },
          removeOnFail: false,
        }
      );

      // Wait for it to retry and fail completely to DLQ
      await new Promise<void>((resolve) => {
        const check = setInterval(async () => {
          const m = await queue.getMetrics();
          if (m.dlq === 1) {
            clearInterval(check);
            resolve();
          }
        }, 50);
      });

      expect(runCount).toBe(2);

      const metrics = await queue.getMetrics();
      expect(metrics.dlq).toBe(1);
      expect(metrics.failed).toBe(1);

      const failedJob = await queue.getJob(jobId);
      expect(failedJob?.state).toBe('failed');
      expect(failedJob?.error).toContain('Execution failed 2');

      await queue.close();
      await worker.shutdown(1000);
    });
  });

  // ─── 2. Group Concurrency & Noisy-Neighbor Mitigation ───────────────────────
  describe('Group Concurrency', () => {
    it('should respect limitsRules and avoid noisy-neighbor starvation', async () => {
      const queueName = 'test-queue-concurrency';
      const queue = new Queue(queueName, REDIS_CONFIG);
      await queue.connect();

      const completedGroups: string[] = [];

      // Handler that blocks for 50ms
      const workerHandler = async (job: Job) => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        completedGroups.push(job.group);
      };

      // Set up worker with:
      // - Fallback concurrency per group = 1
      // - Specific rules: 'tenant.heavy.*' gets a cap of 1
      // - 'tenant.light.*' gets unlimited or fallback (1)
      const worker = new Worker(queueName, workerHandler, REDIS_CONFIG, {
        concurrency: 1, // Fallback limit per group
        workerConcurrency: 10, // Global worker concurrency cap (allows running heavy A and light B in parallel)
        limitsRules: [
          { pattern: 'tenant.heavy.*', limit: 1 },
          { pattern: 'tenant.light.*', limit: 5 }, // higher limit
        ],
      });
      await worker.start();

      // 1. Push 10 heavy jobs for Tenant A ('tenant.heavy.a')
      for (let i = 0; i < 10; i++) {
        await queue.add(`heavy-${i}`, {}, { groupId: 'tenant.heavy.a' });
      }

      // 2. Push 1 light job for Tenant B ('tenant.light.b')
      await queue.add('light-1', {}, { groupId: 'tenant.light.b' });

      // Wait for at least 3 jobs to complete
      await new Promise<void>((resolve) => {
        const check = setInterval(() => {
          if (completedGroups.length >= 3) {
            clearInterval(check);
            resolve();
          }
        }, 30);
      });

      // Assert that Tenant B did NOT get starved behind the 10 heavy jobs of Tenant A!
      // With our group concurrency, since A is limited to 1 concurrent job, and B has high concurrency (or fallback),
      // B's job is acquired and processed immediately.
      // Thus, 'tenant.light.b' should appear very early in the completed list (usually index 0, 1, or 2).
      const bIndex = completedGroups.indexOf('tenant.light.b');
      expect(bIndex).toBeGreaterThanOrEqual(0);
      expect(bIndex).toBeLessThan(3); // Completed within the first few executions!

      await queue.close();
      await worker.shutdown(1000);
    });
  });

  // ─── 3. Lease Fencing & Abort Controller ────────────────────────────────────
  describe('Lease Fencing', () => {
    it('should abort execution via AbortSignal when heartbeat expires or is deleted', async () => {
      const queueName = 'test-queue-fencing';
      const queue = new Queue(queueName, REDIS_CONFIG);
      await queue.connect();

      let signalAborted = false;
      const workerHandler = async (job: Job) => {
        // Wait inside handler and listen to abort signal
        await new Promise<void>((resolve) => {
          if (job.signal.aborted) {
            signalAborted = true;
            resolve();
            return;
          }
          const onAbort = () => {
            signalAborted = true;
            job.signal.removeEventListener('abort', onAbort);
            resolve();
          };
          job.signal.addEventListener('abort', onAbort);
          
          // Force a timeout after 2 seconds just in case
          setTimeout(resolve, 2000);
        });
      };

      const worker = new Worker(queueName, workerHandler, REDIS_CONFIG, {
        concurrency: 2,
        lockDuration: 2000, // Short lock duration for testing
      });
      await worker.start();

      const jobId = await queue.add('fence-task', {}, { groupId: 'group-1' });

      // Wait until job is active
      await new Promise<void>((resolve) => {
        const check = setInterval(async () => {
          const m = await queue.getMetrics();
          if (m.active === 1) {
            clearInterval(check);
            resolve();
          }
        }, 50);
      });

      // Manually delete the heartbeat from Redis to simulate lease expiration
      const heartbeatsKey = `voltrix:mq:${queueName}:heartbeats`;
      await redis.hdel(heartbeatsKey, jobId);

      // Wait a moment for the heartbeat checker (every lockDuration / 3 = 666ms) to detect expiration
      await new Promise<void>((resolve) => setTimeout(resolve, 1000));

      expect(signalAborted).toBe(true);

      await queue.close();
      await worker.shutdown(1000);
    });
  });

  // ─── 4. Poison Pills ────────────────────────────────────────────────────────
  describe('Poison Pills', () => {
    it('should bypass stalled jobs directly to DLQ after exceeding maxStalledCount', async () => {
      const queueName = 'test-queue-poison';
      const queue = new Queue(queueName, REDIS_CONFIG);
      await queue.connect();

      // Handler that doesn't complete, simulating worker crash/freeze
      const workerHandler = async () => {
        await new Promise(() => {}); // never completes
      };

      const worker = new Worker(queueName, workerHandler, REDIS_CONFIG, {
        concurrency: 1,
        lockDuration: 1000, // Safe lock duration
      });
      await worker.start();

      const jobId = await queue.add('poison-task', {}, { groupId: 'group-1', removeOnFail: false });

      // Wait until active
      await new Promise<void>((resolve) => {
        const check = setInterval(async () => {
          const m = await queue.getMetrics();
          if (m.active === 1) {
            clearInterval(check);
            resolve();
          }
        }, 20);
      });

      // Shutdown the active worker to completely stop the heartbeat loop (simulating worker process crash)
      await worker.shutdown(100);

      // Now we manually set the heartbeat to be extremely old to simulate a stale lease
      const heartbeatsKey = `voltrix:mq:${queueName}:heartbeats`;
      const threshold = Date.now() - 5000;
      await redis.hset(heartbeatsKey, jobId, `worker-x:${threshold - 1000}`);

      // Sweep 1 (stalledCount becomes 1, re-queued to waiting)
      let swept = await (redis as any).voltrixCleanStalledJobs(
        queueName,
        String(threshold),
        String(Date.now()),
        '3'
      );
      expect(swept).toContain(jobId);

      // Verify it's waiting again
      let jobState = await queue.getJob(jobId);
      expect(jobState?.state).toBe('waiting');

      // Re-acquire the job manually to make it active again
      await (redis as any).voltrixAcquireJob(
        queueName,
        'worker-y',
        '1',
        String(Date.now())
      );

      // Set heartbeat to old again
      await redis.hset(heartbeatsKey, jobId, `worker-y:${threshold - 1000}`);

      // Sweep 2 (stalledCount becomes 2, re-queued to waiting)
      swept = await (redis as any).voltrixCleanStalledJobs(
        queueName,
        String(threshold),
        String(Date.now()),
        '3'
      );
      expect(swept).toContain(jobId);

      // Re-acquire the job manually to make it active again
      await (redis as any).voltrixAcquireJob(
        queueName,
        'worker-z',
        '1',
        String(Date.now())
      );

      // Set heartbeat to old again
      await redis.hset(heartbeatsKey, jobId, `worker-z:${threshold - 1000}`);

      // Sweep 3 (stalledCount becomes 3, exceeds maxStalledCount = 3 -> fails to DLQ)
      swept = await (redis as any).voltrixCleanStalledJobs(
        queueName,
        String(threshold),
        String(Date.now()),
        '3'
      );
      // It is not returned in recovered array since it goes straight to the DLQ!
      expect(swept).not.toContain(jobId);

      const metrics = await queue.getMetrics();
      expect(metrics.dlq).toBe(1);
      expect(metrics.active).toBe(0);

      const finalJob = await queue.getJob(jobId);
      expect(finalJob?.state).toBe('failed');
      expect(finalJob?.error).toBe('Job stalled too many times');

      await queue.close();
    });
  });

  // ─── 5. Decorators & DI ─────────────────────────────────────────────────────
  describe('Decorators & DI Integration', () => {
    it('should bootstrap processors and inject queues using QueueDiscovery', async () => {
      const container = new DIContainer();
      const queueName = 'decorator-test-queue';

      const processedJobs: any[] = [];

      @QueueProcessor({
        name: queueName,
        concurrency: 2,
      })
      @LimitRule('tenant.heavy.*', 1)
      @LimitRule('tenant.light.*', 10)
      class TestReportProcessor {
        constructor(
          @InjectQueue(queueName) public readonly reportQueue: Queue
        ) {}

        @Process('generate')
        async handleGenerate(job: Job) {
          processedJobs.push(job.data);
          return { done: true };
        }
      }

      // Bootstrap container and discovery
      await QueueDiscovery.bootstrap(container, REDIS_CONFIG);

      // Verify LimitRule metadata merged successfully into the worker and registered in Redis
      const rulesKey = `voltrix:mq:${queueName}:concurrency_rules`;
      const rules = await redis.zrevrange(rulesKey, 0, -1);
      expect(rules).toContain('tenant.light.*:10');
      expect(rules).toContain('tenant.heavy.*:1');

      // Verify Queue is registered and can be resolved
      const injectedQueue = container.resolve<Queue>(`Queue:${queueName}`);
      expect(injectedQueue).toBeDefined();
      expect(injectedQueue.name).toBe(queueName);

      const processorInstance = container.resolve(TestReportProcessor);
      expect(processorInstance).toBeDefined();
      expect(processorInstance.reportQueue).toBe(injectedQueue);

      // Add a job to test execution through bootstrap worker
      await injectedQueue.add('generate', { reportId: '123' }, { groupId: 'tenant-1' });

      // Wait for it to process
      await new Promise<void>((resolve) => {
        const check = setInterval(async () => {
          const m = await injectedQueue.getMetrics();
          if (m.waiting === 0 && m.active === 0 && processedJobs.length === 1) {
            clearInterval(check);
            resolve();
          }
        }, 50);
      });

      expect(processedJobs).toEqual([{ reportId: '123' }]);

      // Gracefully shutdown
      await QueueDiscovery.shutdown(1000);
      await injectedQueue.close();
    });
  });

  // ─── 6. Events, Cron & Traceability ─────────────────────────────────────────
  describe('Events, Cron & Traceability', () => {
    it('should emit life-cycle events, maintain correlationId, and trace transformations performance', async () => {
      const queueName = 'test-queue-observability';
      const queue = new Queue(queueName, REDIS_CONFIG);
      await queue.connect();

      const eventsFired: string[] = [];
      let traceJobId = '';

      const workerHandler = async (job: Job) => {
        traceJobId = job.id;
        await job.updateProgress(50);
        return { ok: true };
      };

      const worker = new Worker(queueName, workerHandler, REDIS_CONFIG, {
        concurrency: 2,
        lockDuration: 5000,
      });

      // Register event listeners
      worker.on('active', (job) => {
        expect(job.correlationId).toBe('my-correlation-id');
        eventsFired.push('active');
      });
      worker.on('progress', (job, percent) => {
        expect(percent).toBe(50);
        eventsFired.push('progress');
      });
      worker.on('completed', (job, result) => {
        expect(result).toEqual({ ok: true });
        eventsFired.push('completed');
      });

      await worker.start();

      await queue.add('test-obs', { data: 1 }, {
        groupId: 'tenant-1',
        correlationId: 'my-correlation-id',
        removeOnComplete: false
      });

      // Wait until completed
      await new Promise<void>((resolve) => {
        const check = setInterval(() => {
          if (eventsFired.includes('completed')) {
            clearInterval(check);
            resolve();
          }
        }, 50);
      });

      expect(eventsFired).toContain('active');
      expect(eventsFired).toContain('progress');
      expect(eventsFired).toContain('completed');

      // Assert traceability metadata is preserved and saved in Redis
      const finishedJob = await queue.getJob(traceJobId);
      expect(finishedJob?.correlationId).toBe('my-correlation-id');
      expect(finishedJob?.transformations).toBeDefined();
      expect(finishedJob?.transformations?.length).toBe(1);
      
      const trace = finishedJob?.transformations?.[0];
      expect(trace?.pluginId).toBe('voltrix:mq');
      expect(trace?.performance?.durationMs).toBeGreaterThanOrEqual(0);
      expect(trace?.performance?.cpuUserSec).toBeDefined();

      await queue.close();
      await worker.shutdown(1000);
    });

    it('should atomically reschedule recurring cron jobs on complete', async () => {
      const queueName = 'test-queue-cron';
      const queue = new Queue(queueName, REDIS_CONFIG);
      await queue.connect();

      let runCount = 0;
      const workerHandler = async () => {
        runCount++;
        return { done: true };
      };

      const worker = new Worker(queueName, workerHandler, REDIS_CONFIG, {
        concurrency: 1,
        lockDuration: 5000,
      });
      await worker.start();

      // Enqueue job with a cron pattern (every 5 minutes)
      await queue.add('cron-task', { foo: 'bar' }, {
        groupId: 'tenant-1',
        cron: '*/5 * * * *',
        removeOnComplete: true // Clean up current job, verify next is rescheduled
      });

      // Wait until job is processed (runCount === 1)
      await new Promise<void>((resolve) => {
        const check = setInterval(() => {
          if (runCount === 1) {
            clearInterval(check);
            resolve();
          }
        }, 50);
      });

      // Wait a moment for worker to perform atomic rescheduling and check metrics
      await new Promise<void>((resolve) => {
        const check = setInterval(async () => {
          const m = await queue.getMetrics();
          if (m.delayed === 1) {
            clearInterval(check);
            resolve();
          }
        }, 50);
      });

      const metrics = await queue.getMetrics();
      expect(metrics.delayed).toBe(1);
      expect(metrics.waiting).toBe(0);

      await queue.close();
      await worker.shutdown(1000);
    });
  });
});
