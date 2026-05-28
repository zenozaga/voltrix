export interface JobTransformation {
  pluginId: string;
  pluginName: string;
  operation: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
  performance?: {
    durationMs: number;
    cpuUserSec?: number;
  };
}

export interface JobPayload {
  data?: unknown;
  attempts?: number;
  maxAttempts?: number;
  backoffType?: 'linear' | 'exponential';
  backoffDelay?: number;
  uniqueId?: string;
  removeOnComplete?: boolean;
  removeOnFail?: boolean;
  cron?: string;
  cronOptions?: Record<string, unknown>;
  correlationId?: string;
  transformations?: JobTransformation[];
}

export interface JobOptions {
  attempts?: number;          // Default: 1
  backoff?: {
    type: 'linear' | 'exponential';
    delay: number;            // ms
  };
  timeout?: number;           // Max execution time in ms (Default: undefined)
  removeOnComplete?: boolean; // Default: true
  removeOnFail?: boolean;     // Default: false
  uniqueId?: string;          // Deduplication key
  runAt?: number;             // Timestamp to run the job
  delay?: number;             // Delay in ms to wait before running
  
  // Cron / Recurring Options
  cron?: string;              // Standard 5-field cron expression (e.g. '*/5 * * * *')
  cronOptions?: {
    startDate?: Date | number;
    endDate?: Date | number;
    tz?: string;
  };

  // Traceability & Correlation IDs
  correlationId?: string;
  transformations?: JobTransformation[];
}

export interface Job<TData = unknown, TResult = unknown> {
  id: string;
  group: string;
  name: string;
  data: TData;
  state: 'waiting' | 'active' | 'delayed' | 'completed' | 'failed';
  attempts: number;
  maxAttempts: number;
  stalledCount: number;
  progress: number;
  timestamp: number;
  runAt?: number;
  result?: TResult;
  error?: string;
  
  // Traceability metadata
  correlationId?: string;
  transformations?: JobTransformation[];

  /** Update execution progress (0-100) dynamically in Redis */
  updateProgress(percent: number): Promise<void>;
  /** Check if the worker's lease expired or the job was aborted */
  isAborted(): boolean;
  /** Access the raw AbortSignal bound to this job's timeout / lease expiration */
  signal: AbortSignal;
}

export interface QueueMetrics {
  waiting: number;            // Total jobs waiting across all groups
  active: number;             // Total active jobs currently running
  delayed: number;            // Total delayed/scheduled jobs
  completed: number;          // Total completed jobs tracked
  failed: number;             // Total failed jobs tracked
  dlq: number;                // Total dead letter queue jobs
  groupsCount: number;        // Total active groups with pending jobs
}

export interface GroupMetrics {
  waiting: number;            // Jobs waiting for this specific group/tenant
  active: number;             // Active jobs running for this specific group/tenant
  limit: number;              // Current concurrency limit set for this group (-1: unlimited)
}

export type JobHandler<TData = unknown, TResult = unknown> = (job: Job<TData, TResult>) => Promise<TResult> | TResult;

export interface LimitRule {
  pattern: string;              // Glob pattern matching the groupId (e.g., 'message.qr.*')
  limit: number;                // Cap for this pattern (-1 for unlimited)
}

export interface WorkerOptions {
  concurrency?: number;         // Fallback concurrency cap per group if not dynamically defined (Default: 1)
  limitsRules?: LimitRule[];    // Centralized pattern-based policies registered in Redis at startup
  lockDuration?: number;        // Heartbeat / Lease expiration window in ms (Default: 30000)
  stalledInterval?: number;     // Interval in ms to sweep stalled jobs (Default: 15000)
  sandbox?: string | URL;       // Path to a separate worker thread file for CPU isolation
  workerConcurrency?: number;   // Global concurrency limit for this worker instance (Default: 100)
}

export interface WorkerEvents<TData = unknown, TResult = unknown> {
  active: (job: Job<TData, TResult>) => void;
  completed: (job: Job<TData, TResult>, result: TResult) => void;
  failed: (job: Job<TData, TResult>, error: Error) => void;
  stalled: (jobId: string) => void;
  progress: (job: Job<TData, TResult>, percent: number) => void;
  error: (error: Error) => void;
}

export interface QueueEvents<TData = unknown> {
  waiting: (jobId: string, groupId: string) => void;
  delayed: (jobId: string, runAt: number) => void;
}

import type { Redis } from 'ioredis';

export interface VoltrixRedis extends Redis {
  voltrixPushJob(
    queueName: string,
    jobId: string,
    groupId: string,
    payload: string,
    score: string,
    delay: string,
    jobName: string,
    maxAttempts: string,
    backoffType: string,
    backoffDelay: string,
    uniqueId: string
  ): Promise<boolean>;

  voltrixAcquireJob(
    queueName: string,
    workerId: string,
    defaultConcurrency: string,
    now: string
  ): Promise<[string, string, string, string] | null>;

  voltrixCompleteJob(
    queueName: string,
    jobId: string,
    groupId: string,
    removeOnComplete: string,
    now: string
  ): Promise<boolean>;

  voltrixFailJob(
    queueName: string,
    jobId: string,
    groupId: string,
    errorMsg: string,
    now: string,
    removeOnFail: string
  ): Promise<boolean>;

  voltrixCleanStalledJobs(
    queueName: string,
    threshold: string,
    now: string,
    maxStalledCount: string
  ): Promise<string[]>;

  voltrixMoveDelayedToWaiting(
    queueName: string,
    now: string
  ): Promise<number>;

  voltrixGetQueueMetrics(
    queueName: string
  ): Promise<[number, number, number, number, number, number, number]>;
}
