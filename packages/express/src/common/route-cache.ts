/**
 * Route Response LRU Cache with TTL
 * Caches frequently accessed route responses to avoid repeated processing
 */

export interface CachedRouteResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string | Buffer;
  timestamp: number;
  ttl: number;
}

export interface RouteCacheKey {
  method: string;
  path: string;
  query?: string; // Optional query string for cache differentiation
}

export class RouteLRUCache {
  private cache: Map<string, CachedRouteResponse>;
  private maxSize: number;
  private defaultTTL: number;
  private stats = {
    hits: 0,
    misses: 0,
    sets: 0,
    evictions: 0
  };

  constructor(maxSize: number = 1000, defaultTTL: number = 300000) { // 5 min default TTL
    this.cache = new Map();
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL;
  }

  // Generate cache key from route info
  private generateKey(routeKey: RouteCacheKey): string {
    const { method, path, query } = routeKey;
    return `${method}:${path}${query ? `?${query}` : ''}`;
  }

  // Cache a route response
  set(routeKey: RouteCacheKey, response: Omit<CachedRouteResponse, 'timestamp' | 'ttl'>, ttl?: number): void {
    const key = this.generateKey(routeKey);
    const now = Date.now();
    
    const cachedResponse: CachedRouteResponse = {
      ...response,
      timestamp: now,
      ttl: ttl || this.defaultTTL
    };

    // Remove oldest if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
        this.stats.evictions++;
      }
    }

    // Update position (LRU)
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    
    this.cache.set(key, cachedResponse);
    this.stats.sets++;
  }

  // Get cached route response
  get(routeKey: RouteCacheKey): CachedRouteResponse | null {
    const key = this.generateKey(routeKey);
    const cached = this.cache.get(key);
    
    if (!cached) {
      this.stats.misses++;
      return null;
    }

    const now = Date.now();
    
    // Check if expired
    if (now - cached.timestamp > cached.ttl) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, cached);
    
    this.stats.hits++;
    return cached;
  }

  // Check if route is cached and not expired
  has(routeKey: RouteCacheKey): boolean {
    const key = this.generateKey(routeKey);
    const cached = this.cache.get(key);
    
    if (!cached) {
      return false;
    }

    const now = Date.now();
    
    if (now - cached.timestamp > cached.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  // Delete specific route from cache
  delete(routeKey: RouteCacheKey): boolean {
    const key = this.generateKey(routeKey);
    return this.cache.delete(key);
  }

  // Clear all cached routes
  clear(): void {
    this.cache.clear();
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      evictions: 0
    };
  }

  // Clear expired entries
  clearExpired(): number {
    const now = Date.now();
    let cleared = 0;
    
    Array.from(this.cache.entries()).forEach(([key, cached]) => {
      if (now - cached.timestamp > cached.ttl) {
        this.cache.delete(key);
        cleared++;
      }
    });
    
    return cleared;
  }

  // Get cache statistics
  getStats() {
    return {
      ...this.stats,
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0
    };
  }

  // Get all cached route keys (for debugging)
  getKeys(): string[] {
    return Array.from(this.cache.keys());
  }

  // Invalidate routes by pattern (useful for API changes)
  invalidatePattern(pattern: RegExp): number {
    let invalidated = 0;
    
    Array.from(this.cache.keys()).forEach(key => {
      if (pattern.test(key)) {
        this.cache.delete(key);
        invalidated++;
      }
    });
    
    return invalidated;
  }
}