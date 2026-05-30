import { Redis, type RedisOptions } from 'ioredis';
import type { IPubSubEngine, WsSocket } from '../types/index.js';
import { MemoryEngine } from './memory-engine.js';

/**
 * 📡 Distributed Redis Pub/Sub Engine.
 * Syncs Rooms/Topics in real-time across a cluster of multiple Voltrix server instances.
 */
export class RedisEngine implements IPubSubEngine {
  private readonly localEngine: MemoryEngine;
  private readonly pubClient: Redis;
  private readonly subClient: Redis;
  private readonly prefix = 'vltx:ws:';
  private isSubscribed = false;

  /**
   * @param app The raw uWS TemplatedApp instance.
   * @param redisConfig Either a Redis URL string or full connection options.
   */
  constructor(app: any, redisConfig: string | RedisOptions) {
    this.localEngine = new MemoryEngine(app);

    // Initialize Redis clients for Publishing and Subscribing
    if (typeof redisConfig === 'string') {
      this.pubClient = new Redis(redisConfig, { maxRetriesPerRequest: null });
      this.subClient = new Redis(redisConfig, { maxRetriesPerRequest: null });
    } else {
      this.pubClient = new Redis({ ...redisConfig, maxRetriesPerRequest: null });
      this.subClient = new Redis({ ...redisConfig, maxRetriesPerRequest: null });
    }

    // Suppress unhandled connection errors to prevent crashes if Redis is offline
    this.pubClient.on('error', () => {});
    this.subClient.on('error', () => {});

    this.setupSubscriptionBridge();
  }

  subscribe(client: WsSocket, topic: string): void {
    this.localEngine.subscribe(client, topic);
    
    if (topic !== 'global') {
      this.localEngine.subscribe(client, 'global');
    }
  }

  unsubscribe(client: WsSocket, topic: string): void {
    this.localEngine.unsubscribe(client, topic);
  }

  async publish(topic: string, message: any, isBinary?: boolean): Promise<void> {
    this.localEngine.publish(topic, message, isBinary);

    const payload = typeof message === 'string' ? message : JSON.stringify(message);
    const packet = JSON.stringify({
      message: payload,
      isBinary: isBinary ?? false
    });

    try {
      await this.pubClient.publish(`${this.prefix}${topic}`, packet);
    } catch (err) {
      // Degrade gracefully if Redis publisher is offline
    }
  }

  async broadcast(message: any, isBinary?: boolean): Promise<void> {
    await this.publish('global', message, isBinary);
  }

  /**
   * 🚏 Clustered pattern subscription bridge.
   * Listens to Redis channels and pipes messages into local uWS channels natively.
   */
  private setupSubscriptionBridge(): void {
    if (this.isSubscribed) return;
    this.isSubscribed = true;

    // Pattern subscribe to all voltrix ws channels
    this.subClient.psubscribe(`${this.prefix}*`).catch(() => {
      this.isSubscribed = false;
    });

    this.subClient.on('pmessage', (_pattern: string, channel: string, message: string) => {
      const topic = channel.slice(this.prefix.length);

      try {
        const data = JSON.parse(message);
        if (data && data.message !== undefined) {
          this.localEngine.publish(topic, data.message, data.isBinary);
        }
      } catch (err) {
        // Suppress parsing errors
      }
    });
  }

  /**
   * Securely disconnects the Redis client connections
   */
  async close(): Promise<void> {
    try {
      await Promise.all([
        this.pubClient.quit(),
        this.subClient.quit()
      ]);
    } catch {
      // Safe exit
    }
  }
}
