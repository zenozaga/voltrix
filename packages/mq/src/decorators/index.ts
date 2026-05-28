import { Metadata } from '@voltrix/core';
import { Inject, DIContainer } from '@voltrix/injector';
import type { WorkerOptions } from '../types/index.js';
import { Queue } from '../core/queue.js';
import { Worker } from '../core/worker.js';

const processorMeta = Metadata.prefix('voltrix:mq:processor');
const processMeta = Metadata.prefix('voltrix:mq:process_handlers');
const limitRulesMeta = Metadata.prefix('voltrix:mq:limit_rules');

/**
 * 🏷️ QueueProcessor decorator for worker classes
 */
export function QueueProcessor(options: WorkerOptions & { name: string }) {
  return function (target: Function) {
    processorMeta.set(target, undefined, options);
    // Mark as injectable
    Reflect.metadata('design:paramtypes', Reflect.getMetadata('design:paramtypes', target) || [])(target);
  };
}

/**
 * 🏷️ Process decorator for method handlers inside QueueProcessor classes
 */
export function Process(name?: string) {
  return function (target: any, propertyKey: string | symbol) {
    const ctor = target.constructor;
    const handlers = processMeta.get(ctor) || {};
    handlers[propertyKey] = name ?? '';
    processMeta.set(ctor, undefined, handlers);
  };
}

/**
 * 🏷️ InjectQueue decorator for parameters to inject specific Queue instances
 */
export function InjectQueue(queueName: string) {
  return Inject(`Queue:${queueName}`);
}

/**
 * 🏷️ LimitRule decorator for registering centralized glob pattern concurrency caps
 */
export function LimitRule(pattern: string, limit: number) {
  return function (target: Function) {
    const rules = limitRulesMeta.get(target) || [];
    rules.push({ pattern, limit });
    limitRulesMeta.set(target, undefined, rules);
  };
}

/**
 * 🚀 Discovery and Bootstrapper Scanner for @voltrix/mq
 */
export class QueueDiscovery {
  private static readonly activeWorkers: Worker[] = [];

  /**
   * Scan and start all decorated Workers, and register Queues in the DI container.
   */
  static async bootstrap(container: DIContainer, redisConfig: any): Promise<void> {
    const classes = Metadata.getTrackedClasses();

    for (const cls of classes) {
      const processorOpts = processorMeta.get(cls);
      if (!processorOpts || !processorOpts.name) continue;

      // Merge stacked @LimitRule decorator rules
      const limitsRules = processorOpts.limitsRules || [];
      const decoratorRules = limitRulesMeta.get(cls) || [];
      processorOpts.limitsRules = [...limitsRules, ...decoratorRules];

      const queueName = processorOpts.name;

      // 1. Register Queue in DI container so it can be injected
      const queueToken = `Queue:${queueName}`;
      if (!container.has(queueToken)) {
        const queueInstance = new Queue(queueName, redisConfig);
        await queueInstance.connect();
        container.register({
          provide: queueToken,
          useValue: queueInstance
        });
      }

      // 2. Register and resolve the QueueProcessor class from DI container
      if (!container.has(cls)) {
        container.register({ token: cls, useClass: cls });
      }

      const processorInstance = container.resolve(cls);
      const handlers = processMeta.get(cls) || {};

      // 3. Create execution handler mapping job names to decorated methods
      const jobHandler = async (job: any) => {
        let methodKey: string | undefined;
        let fallbackKey: string | undefined;

        for (const [key, name] of Object.entries(handlers)) {
          if (name === job.name) {
            methodKey = key;
            break;
          }
          if (name === '') {
            fallbackKey = key;
          }
        }

        const targetKey = methodKey ?? fallbackKey;
        if (!targetKey) {
          throw new Error(`No process handler defined for job name: ${job.name}`);
        }

        return (processorInstance as any)[targetKey](job);
      };

      // 4. Start Worker
      const worker = new Worker(queueName, jobHandler, redisConfig, processorOpts);
      await worker.start();
      
      this.activeWorkers.push(worker);
    }
  }

  /**
   * Stop all active workers gracefully.
   */
  static async shutdown(gracePeriodMs = 5000): Promise<void> {
    for (const worker of this.activeWorkers) {
      await worker.shutdown(gracePeriodMs);
    }
    this.activeWorkers.length = 0;
  }
}
