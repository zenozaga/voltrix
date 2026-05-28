import type { Redis } from 'ioredis';
import type { Job as IJob, JobTransformation } from '../types/index.js';

export class Job<TData = unknown, TResult = unknown> implements IJob<TData, TResult> {
  public id: string;
  public group: string;
  public name: string;
  public data: TData;
  public state: 'waiting' | 'active' | 'delayed' | 'completed' | 'failed';
  public attempts: number;
  public maxAttempts: number;
  public stalledCount: number;
  public progress: number;
  public timestamp: number;
  public runAt?: number;
  public result?: TResult;
  public error?: string;
  
  // Traceability metadata
  public correlationId?: string;
  public transformations?: JobTransformation[];
  
  public lastHeartbeatTime: number = Date.now();
  public lockDuration: number = 30000;
  
  private readonly _redis?: Redis;
  private readonly _queueName?: string;
  private readonly _abortController: AbortController;

  constructor(
    data: Partial<IJob<TData, TResult>> & { id: string; group: string; name: string },
    redis?: Redis,
    queueName?: string,
    abortController?: AbortController
  ) {
    this.id = data.id;
    this.group = data.group;
    this.name = data.name;
    this.data = data.data as TData;
    this.state = data.state ?? 'waiting';
    this.attempts = data.attempts ?? 0;
    this.maxAttempts = data.maxAttempts ?? 1;
    this.stalledCount = data.stalledCount ?? 0;
    this.progress = data.progress ?? 0;
    this.timestamp = data.timestamp ?? Date.now();
    this.runAt = data.runAt;
    this.result = data.result;
    this.error = data.error;
    
    this.correlationId = data.correlationId;
    this.transformations = data.transformations ?? [];

    this._redis = redis;
    this._queueName = queueName;
    this._abortController = abortController ?? new AbortController();
  }

  get signal(): AbortSignal {
    return this._abortController.signal;
  }

  isAborted(): boolean {
    if (this._abortController.signal.aborted) {
      return true;
    }
    if (Date.now() - this.lastHeartbeatTime > this.lockDuration) {
      this.abort();
      return true;
    }
    return false;
  }

  /** Force aborting the job execution */
  abort(): void {
    this._abortController.abort();
  }

  async updateProgress(percent: number): Promise<void> {
    this.progress = Math.max(0, Math.min(100, Math.round(percent)));
    
    if (this._redis && this._queueName) {
      const jobKey = `voltrix:mq:${this._queueName}:job:${this.id}`;
      await this._redis.hset(jobKey, 'progress', String(this.progress));
    }
  }
}
