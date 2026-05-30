import type { SecurityStore } from '../types/index.js';

/**
 * Zero-allocation, high-performance in-memory cache store.
 * Incorporates a lazy-evaluation expiration check and background sweeps.
 */
export class MemoryStore implements SecurityStore {
  private readonly _map = new Map<string, { value: string; expiresAt: number }>();
  private readonly _sweepInterval: NodeJS.Timeout | null = null;

  constructor(sweepMs = 30000) {
    this._sweepInterval = setInterval(() => this.sweep(), sweepMs);
    // Unref the timer so it doesn't prevent Node.js process from exiting cleanly
    if (this._sweepInterval && typeof this._sweepInterval.unref === 'function') {
      this._sweepInterval.unref();
    }
  }

  async get(key: string): Promise<string | null> {
    const entry = this._map.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this._map.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, ttlMs: number): Promise<void> {
    this._map.set(key, {
      value,
      expiresAt: Date.now() + ttlMs
    });
  }

  async increment(key: string, ttlMs: number): Promise<number> {
    const now = Date.now();
    const entry = this._map.get(key);

    if (!entry || now > entry.expiresAt) {
      this._map.set(key, {
        value: '1',
        expiresAt: now + ttlMs
      });
      return 1;
    }

    const val = parseInt(entry.value, 10) + 1;
    entry.value = String(val);
    return val;
  }

  async decrement(key: string): Promise<void> {
    const entry = this._map.get(key);
    if (!entry || Date.now() > entry.expiresAt) return;
    const val = parseInt(entry.value, 10) - 1;
    entry.value = String(val);
  }

  async delete(key: string): Promise<void> {
    this._map.delete(key);
  }

  /**
   * Sweeps expired cache entries out of memory to prevent heap leaks.
   */
  sweep(): void {
    const now = Date.now();
    for (const [key, entry] of this._map.entries()) {
      if (now > entry.expiresAt) {
        this._map.delete(key);
      }
    }
  }

  /**
   * Clean up background resources.
   */
  close(): void {
    if (this._sweepInterval) {
      clearInterval(this._sweepInterval);
    }
  }
}
