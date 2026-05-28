import { Redis, type RedisOptions } from 'ioredis';
import { randomUUID } from 'node:crypto';
import cronParser from 'cron-parser';
import type { WorkerOptions, JobHandler, WorkerEvents, JobTransformation, VoltrixRedis, JobPayload } from '../types/index.js';
import { registerCommands } from './lua-scripts.js';
import { Job } from './job.js';
import { TypedEventEmitter } from '../utils/typed-emitter.js';
import { serializeVbp, deserializeVbp } from '../utils/binary-protocol.js';

export class Worker extends TypedEventEmitter<WorkerEvents> {
  public readonly redis: VoltrixRedis;
  private readonly workerId = randomUUID();
  private running = false;
  private readonly activeJobs = new Map<
    string,
    {
      job: Job;
      abortController: AbortController;
      promise: Promise<void>;
    }
  >();
  private readonly _ownConnection: boolean = false;
  private pubsub?: Redis;
  private pollerTimer?: NodeJS.Timeout;
  private schedulerTimer?: NodeJS.Timeout;
  private stalledTimer?: NodeJS.Timeout;
  private heartbeatTimer?: NodeJS.Timeout;
  private wakeUpResolver?: () => void;
  private fullWakeUpResolver?: () => void;

  constructor(
    public readonly queueName: string,
    private readonly handler: JobHandler,
    redisClient: RedisOptions | Redis,
    private readonly options: WorkerOptions
  ) {
    super();
    let client: Redis;
    if (redisClient instanceof Redis) {
      client = redisClient;
      this._ownConnection = false;
    } else {
      client = new Redis(redisClient as RedisOptions);
      this._ownConnection = true;
    }
    this.redis = registerCommands(client);
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
    const pipeline = this.redis.pipeline();
    pipeline.del(rulesKey);
    if (this.options.limitsRules) {
      for (const rule of this.options.limitsRules) {
        pipeline.zadd(rulesKey, rule.pattern.length, `${rule.pattern}:${rule.limit}`);
      }
    }
    // Register wildcard fallback rule with length 1 (default: -1 / unlimited)
    pipeline.zadd(rulesKey, 1, `*:-1`);
    await pipeline.exec();

    // Initialize Pub/Sub listener for immediate wakeup
    const redisOpts = this.redis.options;
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
    this._startHeartbeatLoop();
  }

  async shutdown(gracePeriodMs: number): Promise<void> {
    if (!this.running) return;
    this.running = false;

    // Stop background timers
    if (this.pollerTimer) clearTimeout(this.pollerTimer);
    if (this.schedulerTimer) clearTimeout(this.schedulerTimer);
    if (this.stalledTimer) clearTimeout(this.stalledTimer);
    if (this.heartbeatTimer) clearTimeout(this.heartbeatTimer);

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

      // Force abort for any remaining active jobs
      for (const { job } of this.activeJobs.values()) {
        job.abort();
      }
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
    const recovered: string[] = await this.redis.voltrixCleanStalledJobs(
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

  private _parseAcquiredJob(res: [Buffer, Buffer, Buffer, Buffer]): { job: Job; payload: JobPayload; abortController: AbortController } {
    const [jobIdBuf, groupIdBuf, payloadBuf, jobNameBuf] = res;
    const jobId = jobIdBuf.toString('utf-8');
    const groupId = groupIdBuf.toString('utf-8');
    const jobName = jobNameBuf.toString('utf-8');

    let payload: JobPayload = { data: undefined, maxAttempts: 1 };
    try {
      payload = deserializeVbp(payloadBuf);
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

    return { job, payload, abortController };
  }

  private _startPollLoop(): void {
    const loop = async () => {
      if (!this.running) return;

      try {
        const localActiveCount = this.activeJobs.size;
        const globalConcurrency = this.options.concurrency ?? -1;

        const isBatchMode = this.options.batch ?? false;
        const defaultBatchSize = isBatchMode ? 64 : 1;
        const batchSize = this.options.batchSize ?? defaultBatchSize;

        if (globalConcurrency === -1 || localActiveCount < globalConcurrency) {
          // Calculate budget
          const budget = globalConcurrency === -1
            ? batchSize
            : Math.min(batchSize, globalConcurrency - localActiveCount);

          if (budget > 0) {
            const batchRes = await this.redis.voltrixAcquireJobsBatchBuffer(
              this.queueName,
              this.workerId,
              '-1', // Default group limit fallback
              String(Date.now()),
              String(budget)
            );

            if (batchRes && batchRes.length > 0) {
              if (!this.running) return;

              const parsed = batchRes.map(res => this._parseAcquiredJob(res));
              const jobs = parsed.map(p => p.job);
              const payloads = parsed.map(p => p.payload);

              // Register jobs as active
              if (isBatchMode) {
                // Emit active event for all jobs
                for (const job of jobs) {
                  this.emit('active', job);
                }

                const promise = this._executeBatch(jobs, payloads);
                for (const p of parsed) {
                  this.activeJobs.set(p.job.id, { job: p.job, abortController: p.abortController, promise });
                }
              } else {
                for (const p of parsed) {
                  this.emit('active', p.job);
                  const promise = this._executeJob(p.job, p.payload);
                  this.activeJobs.set(p.job.id, { job: p.job, abortController: p.abortController, promise });
                }
              }
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
            // No budget, sleep (unlikely, but safe backup)
            await new Promise<void>((resolve) => setTimeout(resolve, 100));
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
      } catch (err) {
        this.emit('error', err instanceof Error ? err : new Error(String(err)));
        // Sleep on error
        await new Promise<void>((resolve) => setTimeout(resolve, 1000));
      }

      // Continue polling loop
      process.nextTick(loop);
    };

    process.nextTick(loop);
  }

  private async _executeBatch(
    jobs: Job<unknown, unknown>[],
    payloads: JobPayload[]
  ): Promise<void> {
    const startTime = Date.now();
    const cpuStart = process.cpuUsage();

    try {
      const batchHandler = this.handler as (jobs: Job<unknown, unknown>[]) => Promise<unknown> | unknown;

      // Run user batch handler
      const results = await batchHandler(jobs);

      const activeJobsList: { job: Job<unknown, unknown>; payload: JobPayload }[] = [];
      for (let i = 0; i < jobs.length; i++) {
        if (!jobs[i].isAborted()) {
          activeJobsList.push({ job: jobs[i], payload: payloads[i] });
        }
      }

      if (activeJobsList.length === 0) return;

      const durationMs = Date.now() - startTime;
      const cpuDiff = process.cpuUsage(cpuStart);
      const now = Date.now();

      const pipeline = this.redis.pipeline() as any;

      for (let i = 0; i < activeJobsList.length; i++) {
        const { job, payload } = activeJobsList[i];
        
        const trace: JobTransformation = {
          pluginId: 'voltrix:mq',
          pluginName: 'VoltrixMessageQueue',
          operation: `process:${job.name}:batch`,
          timestamp: now,
          performance: {
            durationMs,
            cpuUserSec: cpuDiff.user / 1000000
          }
        };

        const updatedTransformations = [...(job.transformations ?? []), trace];
        job.transformations = updatedTransformations;

        const jobKey = `voltrix:mq:${this.queueName}:job:${job.id}`;
        const removeOnComplete = payload.removeOnComplete !== false ? 1 : 0;

        if (removeOnComplete === 0) {
          const completedPayload = serializeVbp({
            ...payload,
            transformations: updatedTransformations
          });
          const resultVal = Array.isArray(results) ? results[i] : results;
          
          pipeline.hset(jobKey, 'payload', completedPayload);
          pipeline.hset(jobKey, 'result', JSON.stringify(resultVal));
          pipeline.voltrixCompleteJob(
            this.queueName,
            job.id,
            job.group,
            '0',
            String(now)
          );
        } else {
          pipeline.voltrixCompleteJob(
            this.queueName,
            job.id,
            job.group,
            '1',
            String(now)
          );
        }

        // Cron Recurring Scheduling
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
              transformations: updatedTransformations
            });

            pipeline.voltrixPushJob(
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
          } catch (cronErr) {
            const errMsg = cronErr instanceof Error ? cronErr.message : String(cronErr);
            this.emit('error', new Error(`Cron rescheduling failed for job ${job.id}: ${errMsg}`));
          }
        }
      }

      await pipeline.exec();

      // Broadcast wakeup trigger
      await this.redis.publish(`voltrix:mq:${this.queueName}:events`, 'waiting');

      for (let i = 0; i < activeJobsList.length; i++) {
        const { job } = activeJobsList[i];
        const resultVal = Array.isArray(results) ? results[i] : results;
        this.emit('completed', job, resultVal);
      }

    } catch (err) {
      const activeJobsList: { job: Job<unknown, unknown>; payload: JobPayload }[] = [];
      for (let i = 0; i < jobs.length; i++) {
        if (!jobs[i].isAborted()) {
          activeJobsList.push({ job: jobs[i], payload: payloads[i] });
        }
      }

      if (activeJobsList.length === 0) return;

      const durationMs = Date.now() - startTime;
      const cpuDiff = process.cpuUsage(cpuStart);
      const errMsg = err instanceof Error ? err.message : String(err);
      const errorMsg = err instanceof Error ? err.stack || err.message : String(err);
      const now = Date.now();

      const pipeline = this.redis.pipeline() as any;

      for (const { job, payload } of activeJobsList) {
        const trace: JobTransformation = {
          pluginId: 'voltrix:mq',
          pluginName: 'VoltrixMessageQueue',
          operation: `process:${job.name}:batch:failed`,
          timestamp: now,
          metadata: { error: errMsg },
          performance: {
            durationMs,
            cpuUserSec: cpuDiff.user / 1000000
          }
        };

        const updatedTransformations = [...(job.transformations ?? []), trace];
        job.transformations = updatedTransformations;

        const jobKey = `voltrix:mq:${this.queueName}:job:${job.id}`;
        const removeOnFail = payload.removeOnFail === true ? 1 : 0;

        if (removeOnFail === 0) {
          const failedPayload = serializeVbp({
            ...payload,
            attempts: Number(payload.attempts || 0) + 1,
            transformations: updatedTransformations
          });
          pipeline.hset(jobKey, 'payload', failedPayload);
          pipeline.voltrixFailJob(
            this.queueName,
            job.id,
            job.group,
            errorMsg,
            String(now),
            '0'
          );
        } else {
          pipeline.voltrixFailJob(
            this.queueName,
            job.id,
            job.group,
            errorMsg,
            String(now),
            '1'
          );
        }
      }

      await pipeline.exec();

      await this.redis.publish(`voltrix:mq:${this.queueName}:events`, 'waiting');

      for (const { job } of activeJobsList) {
        this.emit('failed', job, err instanceof Error ? err : new Error(errorMsg));
      }
    } finally {
      for (const job of jobs) {
        this.activeJobs.delete(job.id);
      }
      if (this.fullWakeUpResolver) {
        this.fullWakeUpResolver();
        this.fullWakeUpResolver = undefined;
      }
    }
  }

  private async _executeJob(job: Job<unknown, unknown>, payload: JobPayload): Promise<void> {
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
      const singleHandler = this.handler as (job: Job<unknown, unknown>) => Promise<unknown> | unknown;
      const result = await singleHandler(job);

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

      // Complete job operation - skip updating hash fields if the job is going to be deleted immediately
      const jobKey = `voltrix:mq:${this.queueName}:job:${job.id}`;
      const removeOnComplete = payload.removeOnComplete !== false ? 1 : 0;

      if (removeOnComplete === 0) {
        const completedPayload = serializeVbp({
          ...payload,
          transformations: updatedTransformations
        });
        
        // Single pipelined network round-trip for all updates
        const pipeline = this.redis.pipeline() as unknown as {
          hset(key: string, field: string, value: string | Buffer): void;
          voltrixCompleteJob(queueName: string, jobId: string, groupId: string, removeOnComplete: string, now: string): void;
          exec(): Promise<unknown>;
        };
        pipeline.hset(jobKey, 'payload', completedPayload);
        pipeline.hset(jobKey, 'result', JSON.stringify(result));
        pipeline.voltrixCompleteJob(
          this.queueName,
          job.id,
          job.group,
          '0',
          String(Date.now())
        );
        await pipeline.exec();
      } else {
        // High-performance direct delete (saves 2 writes and 2 network round-trips!)
        await this.redis.voltrixCompleteJob(
          this.queueName,
          job.id,
          job.group,
          '1',
          String(Date.now())
        );
      }

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

          await this.redis.voltrixPushJob(
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
        } catch (cronErr) {
          const errMsg = cronErr instanceof Error ? cronErr.message : String(cronErr);
          this.emit('error', new Error(`Cron rescheduling failed for job ${job.id}: ${errMsg}`));
        }
      }
    } catch (err) {
      if (job.isAborted()) return;

      const durationMs = Date.now() - startTime;
      const cpuDiff = process.cpuUsage(cpuStart);
      const errMsg = err instanceof Error ? err.message : String(err);
      const trace: JobTransformation = {
        pluginId: 'voltrix:mq',
        pluginName: 'VoltrixMessageQueue',
        operation: `process:${job.name}:failed`,
        timestamp: Date.now(),
        metadata: { error: errMsg },
        performance: {
          durationMs,
          cpuUserSec: cpuDiff.user / 1000000
        }
      };

      const updatedTransformations = [...(job.transformations ?? []), trace];
      job.transformations = updatedTransformations;

      const errorMsg = err instanceof Error ? err.stack || err.message : String(err);
      
      // Fail job operation - skip updating hash fields if the job is going to be deleted immediately
      const jobKey = `voltrix:mq:${this.queueName}:job:${job.id}`;
      const removeOnFail = payload.removeOnFail === true ? 1 : 0;

      if (removeOnFail === 0) {
        const failedPayload = serializeVbp({
          ...payload,
          attempts: Number(payload.attempts || 0) + 1,
          transformations: updatedTransformations
        });
        
        // Single pipelined network round-trip for all updates
        const pipeline = this.redis.pipeline() as unknown as {
          hset(key: string, field: string, value: string | Buffer): void;
          voltrixFailJob(queueName: string, jobId: string, groupId: string, errorMsg: string, now: string, removeOnFail: string): void;
          exec(): Promise<unknown>;
        };
        pipeline.hset(jobKey, 'payload', failedPayload);
        pipeline.voltrixFailJob(
          this.queueName,
          job.id,
          job.group,
          errorMsg,
          String(Date.now()),
          '0'
        );
        await pipeline.exec();
      } else {
        // High-performance direct fail/delete
        await this.redis.voltrixFailJob(
          this.queueName,
          job.id,
          job.group,
          errorMsg,
          String(Date.now()),
          '1'
        );
      }

      // Broadcast wakeup trigger on job failure so that any sleeping pollers can immediately acquire next jobs
      await this.redis.publish(`voltrix:mq:${this.queueName}:events`, 'waiting');

      // Emit failed event
      this.emit('failed', job, err instanceof Error ? err : new Error(errorMsg));
    } finally {
      // Clean active registry
      this.activeJobs.delete(job.id);
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
        const count = await this.redis.voltrixMoveDelayedToWaiting(this.queueName, String(Date.now()));
        if (count > 0) {
          // Broadcast wakeup to other workers
          await this.redis.publish(`voltrix:mq:${this.queueName}:events`, 'waiting');
        }
      } catch (err) {
        this.emit('error', err instanceof Error ? err : new Error(String(err)));
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
      } catch (err) {
        this.emit('error', err instanceof Error ? err : new Error(String(err)));
      }

      this.stalledTimer = setTimeout(loop, interval);
    };

    this.stalledTimer = setTimeout(loop, interval);
  }

  private _startHeartbeatLoop(): void {
    const lockDuration = this.options.lockDuration ?? 30000;
    const interval = Math.max(100, Math.floor(lockDuration / 3));

    const loop = async () => {
      if (!this.running) return;

      try {
        const activeSize = this.activeJobs.size;
        if (activeSize > 0) {
          const heartbeatsKey = `voltrix:mq:${this.queueName}:heartbeats`;
          const pipeline = this.redis.pipeline();
          
          const jobsList: Array<{
            job: Job<unknown, unknown>;
            abortController: AbortController;
            promise: Promise<void>;
          }> = [];
          for (const activeJob of this.activeJobs.values()) {
            pipeline.hset(heartbeatsKey, activeJob.job.id, `${this.workerId}:${Date.now()}`);
            jobsList.push(activeJob);
          }

          const results = await pipeline.exec();
          if (results) {
            for (let i = 0; i < results.length; i++) {
              const resultInfo = results[i];
              if (resultInfo) {
                const [err, res] = resultInfo;
                const activeJob = jobsList[i];
                
                if (err || res === 1) {
                  // Lock expired or stolen
                  activeJob.job.abort();
                } else {
                  activeJob.job.lastHeartbeatTime = Date.now();
                }
              }
            }
          }
        }
      } catch (err) {
        this.emit('error', err instanceof Error ? err : new Error(String(err)));
      }

      this.heartbeatTimer = setTimeout(loop, interval);
    };

    this.heartbeatTimer = setTimeout(loop, interval);
  }
}
