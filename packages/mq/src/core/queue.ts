import { Redis, type RedisOptions } from 'ioredis';
import { randomUUID } from 'node:crypto';
import type { QueueMetrics, GroupMetrics, JobOptions, QueueEvents, VoltrixRedis, JobPayload } from '../types/index.js';
import { registerCommands } from './lua-scripts.js';
import { Job } from './job.js';
import { TypedEventEmitter } from '../utils/typed-emitter.js';

export class Queue extends TypedEventEmitter<QueueEvents> {
  public readonly redis: VoltrixRedis;
  private readonly _ownConnection: boolean = false;

  constructor(
    public readonly name: string,
    redisClient: RedisOptions | Redis
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

  async connect(): Promise<void> {
    if (this.redis.status === 'wait') {
      await this.redis.connect();
    }
  }

  async add<TData = unknown>(
    name: string,
    data: TData,
    options: JobOptions & { groupId: string }
  ): Promise<string> {
    const jobId = randomUUID();
    const groupId = options.groupId;
    
    // Deduplication Lock
    if (options.uniqueId) {
      const lockKey = `voltrix:mq:${this.name}:unique:${options.uniqueId}`;
      const set = await this.redis.set(lockKey, jobId, 'PX', 24 * 60 * 60 * 1000, 'NX'); // 24h default TTL
      if (!set) {
        const existingId = await this.redis.get(lockKey);
        if (existingId) return existingId;
      }
    }

    const score = options.runAt ?? (options.backoff?.delay ? Date.now() + options.backoff.delay : Date.now());
    const delay = options.backoff?.delay ?? (options.runAt ? Math.max(0, options.runAt - Date.now()) : 0);

    const correlationId = options.correlationId ?? randomUUID();
    const transformations = options.transformations ?? [];

    const payload = JSON.stringify({
      data,
      attempts: 0,
      maxAttempts: options.attempts ?? 1,
      backoffType: options.backoff?.type ?? 'linear',
      backoffDelay: options.backoff?.delay ?? 1000,
      uniqueId: options.uniqueId,
      removeOnComplete: options.removeOnComplete,
      removeOnFail: options.removeOnFail,
      cron: options.cron,
      cronOptions: options.cronOptions,
      correlationId,
      transformations
    });

    // Execute Push atomic script
    await this.redis.voltrixPushJob(
      this.name,
      jobId,
      groupId,
      payload,
      String(score),
      String(delay),
      name,
      String(options.attempts ?? 1),
      options.backoff?.type ?? 'linear',
      String(options.backoff?.delay ?? 1000),
      options.uniqueId ?? ''
    );

    // Emit local events & publish Pub/Sub wakeup trigger immediately
    if (delay > 0) {
      this.emit('delayed', jobId, score);
    } else {
      this.emit('waiting', jobId, groupId);
      await this.redis.publish(`voltrix:mq:${this.name}:events`, 'waiting');
    }

    return jobId;
  }

  async getJob(jobId: string): Promise<Job | null> {
    const jobKey = `voltrix:mq:${this.name}:job:${jobId}`;
    const hash = await this.redis.hgetall(jobKey);
    if (!hash || !hash.id) return null;
    
    let meta: JobPayload = { data: undefined };
    if (hash.payload) {
      try {
        meta = JSON.parse(hash.payload) as JobPayload;
      } catch {}
    }

    return new Job({
      id: hash.id,
      group: hash.group,
      name: hash.name ?? '',
      data: meta.data,
      state: hash.state as 'waiting' | 'active' | 'delayed' | 'completed' | 'failed',
      attempts: Number(hash.attempts || '0'),
      maxAttempts: Number(hash.maxAttempts || '1'),
      stalledCount: Number(hash.stalledCount || '0'),
      progress: Number(hash.progress || '0'),
      timestamp: Number(hash.timestamp || Date.now()),
      runAt: hash.runAt ? Number(hash.runAt) : undefined,
      result: hash.result ? JSON.parse(hash.result) : undefined,
      error: hash.error,
      correlationId: meta.correlationId,
      transformations: meta.transformations
    }, this.redis, this.name);
  }

  async getMetrics(): Promise<QueueMetrics> {
    const res = await this.redis.voltrixGetQueueMetrics(this.name);
    return {
      waiting: Number(res[0] || '0'),
      active: Number(res[1] || '0'),
      delayed: Number(res[2] || '0'),
      completed: Number(res[3] || '0'),
      failed: Number(res[4] || '0'),
      dlq: Number(res[5] || '0'),
      groupsCount: Number(res[6] || '0')
    };
  }

  async getGroupMetrics(groupId: string): Promise<GroupMetrics> {
    const waiting = await this.redis.llen(`voltrix:mq:${this.name}:group:${groupId}`);
    const active = Number(await this.redis.hget(`voltrix:mq:${this.name}:active_count`, groupId) || '0');
    const limit = Number(await this.redis.hget(`voltrix:mq:${this.name}:group_limits`, groupId) || '-1');
    return { waiting, active, limit };
  }

  async setGroupLimit(groupId: string, limit: number): Promise<void> {
    await this.redis.hset(`voltrix:mq:${this.name}:group_limits`, groupId, String(limit));
  }

  async close(): Promise<void> {
    if (this._ownConnection) {
      await this.redis.quit();
    }
  }
}
