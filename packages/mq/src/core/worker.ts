import { Redis, type RedisOptions } from 'ioredis';
import { randomUUID } from 'node:crypto';
import cronParser from 'cron-parser';
import type { WorkerOptions, JobHandler, WorkerEvents, JobTransformation } from '../types/index.js';
import { registerCommands } from './lua-scripts.js';
import { Job } from './job.js';
import { TypedEventEmitter } from '../utils/typed-emitter.js';

export class Worker extends TypedEventEmitter<WorkerEvents> {
  public readonly redis: Redis;
  private readonly workerId = randomUUID();
  private running = false;
  private readonly activeJobs = new Map<
    string,
    {
      job: Job;
      abortController: AbortController;
      heartbeatInterval: NodeJS.Timeout;
      promise: Promise<void>;
    }
  >();
  private readonly _ownConnection: boolean = false;
  private pubsub?: Redis;
  private pollerTimer?: NodeJS.Timeout;
  private schedulerTimer?: NodeJS.Timeout;
  private stalledTimer?: NodeJS.Timeout;
  private wakeUpResolver?: () => void;
  private fullWakeUpResolver?: () => void;

  constructor(
    public readonly queueName: string,
    private readonly handler: JobHandler,
    redisClient: RedisOptions | Redis,
    private readonly options: WorkerOptions
  ) {
    super();
    if (redisClient instanceof Redis) {
      this.redis = redisClient;
      this._ownConnection = false;
    } else {
      this.redis = new Redis(redisClient as RedisOptions);
      this._ownConnection = true;
    }
    registerCommands(this.redis);
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    // Connect Redis
    if (this.redis.status === 'wait') {
      await this.redis.connect();
    }

    // Register centralized concurrency limits in Redis using ZSET (scored by pattern length descending)
    const rulesKey = `voltrix:mq:${this.queueName}:concurrency_rules`;
    await this.redis.del(rulesKey);
    if (this.options.limitsRules) {
      for (const rule of this.options.limitsRules) {
        await this.redis.zadd(rulesKey, rule.pattern.length, `${rule.pattern}:${rule.limit}`);
      }
    }
    // Register wildcard fallback rule with length 1
    await this.redis.zadd(rulesKey, 1, `*:${this.options.concurrency ?? 1}`);

    // Initialize Pub/Sub listener for immediate wakeup
    const redisOpts = (this.redis as any).options;
    this.pubsub = new Redis(redisOpts);
    await this.pubsub.subscribe(`voltrix:mq:${this.queueName}:events`);
    this.pubsub.on('message', () => {
      if (this.wakeUpResolver) {
        this.wakeUpResolver();
        this.wakeUpResolver = undefined;
      }
    });

    // Start background loops
    this._startPollLoop();
    this._startSchedulerLoop();
    this._startStalledSweepLoop();
  }

  async shutdown(gracePeriodMs: number): Promise<void> {
    if (!this.running) return;
    this.running = false;

    // Stop background timers
    if (this.pollerTimer) clearTimeout(this.pollerTimer);
    if (this.schedulerTimer) clearTimeout(this.schedulerTimer);
    if (this.stalledTimer) clearTimeout(this.stalledTimer);

    // Unsubscribe and disconnect Pub/Sub
    if (this.pubsub) {
      await this.pubsub.unsubscribe();
      await this.pubsub.quit();
    }

    // Wake up sleeping poller to let it exit cleanly
    if (this.wakeUpResolver) {
      this.wakeUpResolver();
    }
    if (this.fullWakeUpResolver) {
      this.fullWakeUpResolver();
    }

    // Await active jobs gracefully
    if (this.activeJobs.size > 0) {
      const activePromises = Array.from(this.activeJobs.values()).map(({ promise }) => promise);

      await Promise.race([
        Promise.all(activePromises),
        new Promise((resolve) => setTimeout(resolve, gracePeriodMs))
      ]);

      // Force abort and clear intervals for any remaining active jobs
      for (const { job, heartbeatInterval } of this.activeJobs.values()) {
        clearInterval(heartbeatInterval);
        job.abort();
      }
    }

    // Synchronously clear all intervals in activeJobs map just in case to prevent leaks
    for (const { heartbeatInterval } of this.activeJobs.values()) {
      clearInterval(heartbeatInterval);
    }
    this.activeJobs.clear();

    if (this._ownConnection) {
      await this.redis.quit();
    }
  }

  async sweepStalled(): Promise<string[]> {
    const lockDuration = this.options.lockDuration ?? 30000;
    const threshold = Date.now() - lockDuration;
    
    // Call Lua Stalled Sweep atomic script (maxStalledCount = 3)
    const recovered: string[] = await (this.redis as any).voltrixCleanStalledJobs(
      this.queueName,
      String(threshold),
      String(Date.now()),
      '3'
    );

    if (recovered && recovered.length > 0) {
      for (const jobId of recovered) {
        this.emit('stalled', jobId);
      }
      await this.redis.publish(`voltrix:mq:${this.queueName}:events`, 'waiting');
    }

    return recovered || [];
  }

  private _startPollLoop(): void {
    const loop = async () => {
      if (!this.running) return;

      try {
        const localActiveCount = this.activeJobs.size;
        const workerConcurrency = this.options.workerConcurrency ?? 100; // Global worker concurrency cap

        if (localActiveCount < workerConcurrency) {
          // Poll Redis for eligible job under group concurrency rules
          const res = await (this.redis as any).voltrixAcquireJob(
            this.queueName,
            this.workerId,
            String(this.options.concurrency ?? 1), // default group-level cap
            String(Date.now())
          );

          if (res) {
            if (!this.running) return;
            const [jobId, groupId, payloadStr, jobName] = res;
            let payload: any = { data: undefined, maxAttempts: 1 };
            try {
              payload = JSON.parse(payloadStr);
            } catch {}

            const abortController = new AbortController();
            const job = new Job({
              id: jobId,
              group: groupId,
              name: jobName,
              data: payload.data,
              state: 'active',
              attempts: Number(payload.attempts || '0'),
              maxAttempts: Number(payload.maxAttempts || '1'),
              stalledCount: 0,
              progress: 0,
              timestamp: Date.now(),
              correlationId: payload.correlationId,
              transformations: payload.transformations
            }, this.redis, this.queueName, abortController);

            const lockDuration = this.options.lockDuration ?? 30000;
            job.lockDuration = lockDuration;
            job.lastHeartbeatTime = Date.now();

            // Emit active event
            this.emit('active', job);

            // Lease renewal heartbeat loop
            const heartbeatInterval = setInterval(async () => {
              try {
                const heartbeatsKey = `voltrix:mq:${this.queueName}:heartbeats`;
                const set = await this.redis.hset(heartbeatsKey, jobId, `${this.workerId}:${Date.now()}`);
                // If Redis cleared the heartbeat key, or it returned 1 (new field set unexpectedly, indicating lock expired)
                if (set === 1) {
                  job.abort();
                  clearInterval(heartbeatInterval);
                } else {
                  job.lastHeartbeatTime = Date.now();
                }
              } catch (err: any) {
                job.abort();
                clearInterval(heartbeatInterval);
                this.emit('error', err);
              }
            }, lockDuration / 3);

            const promise = this._executeJob(job, payload);
            this.activeJobs.set(jobId, { job, abortController, heartbeatInterval, promise });
          } else {
            // Sleep when no eligible jobs
            await new Promise<void>((resolve) => {
              this.wakeUpResolver = resolve;
              this.pollerTimer = setTimeout(() => {
                if (this.wakeUpResolver === resolve) {
                  this.wakeUpResolver = undefined;
                  resolve();
                }
              }, 1000);
            });
          }
        } else {
          // Poller is full, sleep until a slot opens up on job completion
          await new Promise<void>((resolve) => {
            this.fullWakeUpResolver = resolve;
            this.pollerTimer = setTimeout(() => {
              if (this.fullWakeUpResolver === resolve) {
                this.fullWakeUpResolver = undefined;
                resolve();
              }
            }, 1000);
          });
        }
      } catch (err: any) {
        this.emit('error', err);
        // Sleep on error
        await new Promise<void>((resolve) => setTimeout(resolve, 1000));
      }

      // Continue polling loop
      process.nextTick(loop);
    };

    process.nextTick(loop);
  }

  private async _executeJob(job: Job, payload: any): Promise<void> {
    const startTime = Date.now();
    const cpuStart = process.cpuUsage();

    try {
      // Listen to progress updates to bubble them up
      const progressListener = async () => {
        this.emit('progress', job, job.progress);
      };
      
      const originalUpdateProgress = job.updateProgress;
      job.updateProgress = async (percent: number) => {
        await originalUpdateProgress.call(job, percent);
        progressListener();
      };

      // Run user handler
      const result = await this.handler(job);

      if (job.isAborted()) {
        // Job was aborted mid-execution, discard completion write to let stalled supervisor recover or fail
        return;
      }

      // Capture performance metrics for Trazabilidad
      const durationMs = Date.now() - startTime;
      const cpuDiff = process.cpuUsage(cpuStart);
      const trace: JobTransformation = {
        pluginId: 'voltrix:mq',
        pluginName: 'VoltrixMessageQueue',
        operation: `process:${job.name}`,
        timestamp: Date.now(),
        performance: {
          durationMs,
          cpuUserSec: cpuDiff.user / 1000000
        }
      };

      const updatedTransformations = [...(job.transformations ?? []), trace];
      job.transformations = updatedTransformations;

      // Update payload in Redis to save transformations trace
      const jobKey = `voltrix:mq:${this.queueName}:job:${job.id}`;
      const completedPayload = JSON.stringify({
        ...payload,
        transformations: updatedTransformations
      });
      await this.redis.hset(jobKey, 'payload', completedPayload);
      await this.redis.hset(jobKey, 'result', JSON.stringify(result));

      // Complete job atomic operation
      const removeOnComplete = payload.removeOnComplete !== false ? 1 : 0;
      await (this.redis as any).voltrixCompleteJob(
        this.queueName,
        job.id,
        job.group,
        String(removeOnComplete),
        String(Date.now())
      );

      // Broadcast wakeup trigger on job completion so that any sleeping pollers can immediately acquire next jobs
      await this.redis.publish(`voltrix:mq:${this.queueName}:events`, 'waiting');

      // Emit completed event
      this.emit('completed', job, result);

      // ─── Cron Recurring Scheduling ──────────────────────────────────────────
      if (payload.cron) {
        try {
          const parser = cronParser.parseExpression(payload.cron, payload.cronOptions);
          const nextDate = parser.next().toDate();
          const nextRunAt = nextDate.getTime();
          const delay = Math.max(0, nextRunAt - Date.now());

          const nextJobId = randomUUID();
          const nextPayload = JSON.stringify({
            ...payload,
            attempts: 0,
            transformations: updatedTransformations // Pass transformations trace down to future cycles!
          });

          await (this.redis as any).voltrixPushJob(
            this.queueName,
            nextJobId,
            job.group,
            nextPayload,
            String(nextRunAt),
            String(delay),
            job.name,
            String(payload.maxAttempts ?? 1),
            payload.backoffType ?? 'linear',
            String(payload.backoffDelay ?? 1000),
            payload.uniqueId ?? ''
          );

          // Broadcast wakeup trigger
          await this.redis.publish(`voltrix:mq:${this.queueName}:events`, 'waiting');
        } catch (cronErr: any) {
          this.emit('error', new Error(`Cron rescheduling failed for job ${job.id}: ${cronErr.message}`));
        }
      }
    } catch (err: any) {
      if (job.isAborted()) return;

      const durationMs = Date.now() - startTime;
      const cpuDiff = process.cpuUsage(cpuStart);
      const trace: JobTransformation = {
        pluginId: 'voltrix:mq',
        pluginName: 'VoltrixMessageQueue',
        operation: `process:${job.name}:failed`,
        timestamp: Date.now(),
        metadata: { error: err.message },
        performance: {
          durationMs,
          cpuUserSec: cpuDiff.user / 1000000
        }
      };

      const updatedTransformations = [...(job.transformations ?? []), trace];
      job.transformations = updatedTransformations;

      const errorMsg = err instanceof Error ? err.stack || err.message : String(err);
      
      // Update payload in Redis to save transformations trace
      const jobKey = `voltrix:mq:${this.queueName}:job:${job.id}`;
      const failedPayload = JSON.stringify({
        ...payload,
        attempts: Number(payload.attempts || 0) + 1,
        transformations: updatedTransformations
      });
      await this.redis.hset(jobKey, 'payload', failedPayload);

      const removeOnFail = payload.removeOnFail === true ? 1 : 0;
      
      // Fail job atomic operation (handles backoffs, retries, and DLQ)
      await (this.redis as any).voltrixFailJob(
        this.queueName,
        job.id,
        job.group,
        errorMsg,
        String(Date.now()),
        String(removeOnFail)
      );

      // Broadcast wakeup trigger on job failure so that any sleeping pollers can immediately acquire next jobs
      await this.redis.publish(`voltrix:mq:${this.queueName}:events`, 'waiting');

      // Emit failed event
      this.emit('failed', job, err instanceof Error ? err : new Error(errorMsg));
    } finally {
      // Clean heartbeat timer and active registry
      const active = this.activeJobs.get(job.id);
      if (active) {
        clearInterval(active.heartbeatInterval);
        this.activeJobs.delete(job.id);
      }
      if (this.fullWakeUpResolver) {
        this.fullWakeUpResolver();
        this.fullWakeUpResolver = undefined;
      }
    }
  }

  private _startSchedulerLoop(): void {
    const loop = async () => {
      if (!this.running) return;

      try {
        // Move planified/delayed jobs to waiting
        const count = await (this.redis as any).voltrixMoveDelayedToWaiting(this.queueName, String(Date.now()));
        if (count > 0) {
          // Broadcast wakeup to other workers
          await this.redis.publish(`voltrix:mq:${this.queueName}:events`, 'waiting');
        }
      } catch (err: any) {
        this.emit('error', err);
      }

      this.schedulerTimer = setTimeout(loop, 1000);
    };

    this.schedulerTimer = setTimeout(loop, 1000);
  }

  private _startStalledSweepLoop(): void {
    const interval = this.options.stalledInterval ?? 15000;
    const loop = async () => {
      if (!this.running) return;

      try {
        await this.sweepStalled();
      } catch (err: any) {
        this.emit('error', err);
      }

      this.stalledTimer = setTimeout(loop, interval);
    };

    this.stalledTimer = setTimeout(loop, interval);
  }
}
