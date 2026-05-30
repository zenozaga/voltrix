import { Redis, type RedisOptions } from 'ioredis';
import type { SecurityStore } from '../types/index.js';

/**
 * High-performance, distributed cache store utilizing Redis.
 * Employs a custom atomic Lua script for sliding-window rate limiting increments.
 */
export class RedisStore implements SecurityStore {
  public readonly redis: Redis;
  private readonly _ownConnection: boolean = false;

  constructor(redisClient: RedisOptions | Redis) {
    if (redisClient instanceof Redis) {
      this.redis = redisClient;
      this._ownConnection = false;
    } else {
      this.redis = new Redis(redisClient as RedisOptions);
      this._ownConnection = true;
    }

    // Register atomic Lua script for rate limiter increments
    this.redis.defineCommand('voltrixSecurityIncrement', {
      numberOfKeys: 1,
      lua: `
        local current = redis.call('INCR', KEYS[1])
        if current == 1 then
            redis.call('PEXPIRE', KEYS[1], ARGV[1])
        end
        return current
      `
    });
  }

  async get(key: string): Promise<string | null> {
    return this.redis.get(key);
  }

  async set(key: string, value: string, ttlMs: number): Promise<void> {
    await this.redis.set(key, value, 'PX', ttlMs);
  }

  async increment(key: string, ttlMs: number): Promise<number> {
    // Invoke the custom registered atomic Lua command
    return (this.redis as any).voltrixSecurityIncrement(key, String(ttlMs));
  }

  async decrement(key: string): Promise<void> {
    await this.redis.decr(key);
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(key);
  }

  /**
   * Close connections if this store initialized its own Redis client.
   */
  async close(): Promise<void> {
    if (this._ownConnection) {
      await this.redis.quit();
    }
  }
}
