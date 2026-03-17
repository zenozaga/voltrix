/**
 * Performance and statistics types for Voltrix
 */

// Performance metrics
export interface PerformanceMetrics {
  requestCount: number;
  totalDuration: number;
  averageLatency: number;
  memoryUsage: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
    arrayBuffers: number;
  };
}

// Object Pool for performance optimization
export interface ObjectPool<T> {
  acquire(): T;
  release(obj: T): void;
  size(): number;
  clear(): void;
}

// Application Statistics
export interface AppStats {
  routes: {
    totalRoutes: number;
    staticRoutes: number;
    paramRoutes: number;
    wildcardRoutes: number;
  };
  websockets: {
    totalWebSockets: number;
    activeConnections: number;
  };
  middleware: {
    globalMiddleware: number;
    routeMiddleware: number;
  };
}