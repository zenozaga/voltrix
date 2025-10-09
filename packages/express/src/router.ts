import type { 
  VoltrixRouter, 
  RouteHandler, 
  Middleware, 
  Route, 
  RequestParams, 
  RouteMatch 
} from './types.js';

/**
 * Ultra-optimized Router with multiple performance layers and HTTP methods
 * 
 * Combines:
 * 1. Route matching engine (O(1) static routes, LRU cache, compiled regex)
 * 2. Express-compatible HTTP methods (get, post, put, delete, etc.)
 * 3. Middleware and router mounting support
 * 
 * Performance Strategy:
 * 1. Static routes: O(1) HashMap lookup for exact matches
 * 2. Compiled regex: Pre-compiled patterns for dynamic routes
 * 3. Route caching: LRU cache for frequently accessed routes
 * 4. Fast parameter extraction: Optimized parameter parsing
 */
export class Router implements VoltrixRouter {
  // Route matching engine
  private routes: Route[] = [];
  private staticRoutes = new Map<string, RouteHandler>(); // O(1) static routes
  private cachedMatches = new Map<string, RouteMatch | null>(); // LRU-like cache
  private cacheMaxSize = 1000; // Configurable cache size

  // Router functionality
  private routerRoutes: Array<{
    method: string;
    path: string;
    handler: RouteHandler;
  }> = [];

  private middlewares: Array<{
    path?: string;
    middleware: Middleware | VoltrixRouter;
  }> = [];
  
  // Performance counters for monitoring
  private stats = {
    cacheHits: 0,
    cacheMisses: 0,
    staticMatches: 0,
    dynamicMatches: 0,
  };

  /**
   * Add a route to the matching engine with optimized performance
   */
  addRoute(method: string, pattern: string, handler: RouteHandler): void {
    const upperMethod = method.toUpperCase();

    // Level 1: Static routes - O(1) HashMap lookup for maximum performance
    if (this.isStaticRoute(pattern)) {
      const key = `${upperMethod}:${pattern}`;
      this.staticRoutes.set(key, handler);
      return;
    }

    // Level 2: Dynamic routes - Pre-compile patterns for fast matching
    const route: Route = {
      method: upperMethod,
      pattern,
      handler,
    };

    this.compileRoute(route);
    
    // Insert route in optimal position (most specific patterns first)
    this.insertRouteOptimally(route);
    
    // Clear cache when routes change to maintain consistency
    this.clearCache();
  }

  /**
   * Check if route pattern is static (no parameters or wildcards)
   */
  private isStaticRoute(pattern: string): boolean {
    return !pattern.includes(':') && !pattern.includes('*') && !pattern.includes('(');
  }

  /**
   * Clear route cache
   */
  private clearCache(): void {
    this.cachedMatches.clear();
  }

  /**
   * Insert route in optimal position for fastest matching
   * Routes with fewer parameters should be checked first
   */
  private insertRouteOptimally(route: Route): void {
    // Calculate route complexity score (lower = simpler = faster)
    const complexity = this.calculateRouteComplexity(route.pattern);
    
    // Find optimal insertion point
    let insertIndex = 0;
    for (let i = 0; i < this.routes.length; i++) {
      const existingRoute = this.routes[i];
      if (existingRoute) {
        const existingComplexity = this.calculateRouteComplexity(existingRoute.pattern);
        if (complexity >= existingComplexity) {
          insertIndex = i + 1;
        } else {
          break;
        }
      }
    }
    
    this.routes.splice(insertIndex, 0, route);
  }

  /**
   * Calculate route complexity for optimal ordering
   * Lower score = higher priority in matching order
   */
  private calculateRouteComplexity(pattern: string): number {
    let score = 0;
    
    // Static segments have lowest complexity
    const segments = pattern.split('/').filter(Boolean);
    for (const segment of segments) {
      if (segment.startsWith(':')) {
        score += 10; // Parameter segments
      } else if (segment === '*') {
        score += 100; // Wildcard segments (highest complexity)
      } else {
        score += 1; // Static segments (lowest complexity)
      }
    }
    
    return score;
  }

  /**
   * Compile route pattern to regex for efficient matching
   */
  private compileRoute(route: Route): void {
    const paramNames: string[] = [];
    let regexPattern = route.pattern;

    // Replace Express-style parameters (:param) with regex groups first
    regexPattern = regexPattern.replace(/:([^/]+)/g, (_, paramName: string) => {
      paramNames.push(paramName);
      return '__PARAM_GROUP__';
    });

    // Handle wildcards (*) 
    regexPattern = regexPattern.replace(/\*/g, '__WILDCARD_GROUP__');

    // Escape special regex characters
    regexPattern = regexPattern.replace(/[.+?^${}|[\]\\]/g, '\\$&');

    // Replace placeholders with actual regex groups
    regexPattern = regexPattern.replace(/__PARAM_GROUP__/g, '([^/]+)');
    regexPattern = regexPattern.replace(/__WILDCARD_GROUP__/g, '(.*)');

    // Ensure exact match
    regexPattern = `^${regexPattern}$`;

    try {
      route.regex = new RegExp(regexPattern);
      route.paramNames = paramNames;
    } catch (error) {
      throw new Error(`Invalid route pattern: ${route.pattern} - ${error}`);
    }
  }

  /**
   * Ultra-optimized route matching with performance monitoring
   */
  match(method: string, path: string): RouteMatch | null {
    const upperMethod = method.toUpperCase();
    const cacheKey = `${upperMethod}:${path}`;

    // Level 1: Cache lookup - O(1) for repeated requests
    if (this.cachedMatches.has(cacheKey)) {
      this.stats.cacheHits++;
      return this.cachedMatches.get(cacheKey)!;
    }

    this.stats.cacheMisses++;
    let result: RouteMatch | null = null;

    // Level 2: Static routes - O(1) HashMap lookup
    const staticKey = `${upperMethod}:${path}`;
    const staticHandler = this.staticRoutes.get(staticKey);
    if (staticHandler) {
      this.stats.staticMatches++;
      result = {
        handler: staticHandler,
        params: {},
      };
    } else {
      // Level 3: Dynamic route matching with optimized regex
      result = this.matchDynamicRoutes(upperMethod, path);
    }

    // Cache the result (with simple LRU eviction)
    this.cacheResult(cacheKey, result);
    
    return result;
  }

  /**
   * Optimized dynamic route matching
   * Routes are pre-sorted by complexity for fastest matching
   */
  private matchDynamicRoutes(method: string, path: string): RouteMatch | null {
    // Early exit for empty routes
    if (this.routes.length === 0) return null;

    // Routes are already sorted by complexity (simplest first)
    for (const route of this.routes) {
      if (route.method === method && route.regex) {
        const match = route.regex.exec(path);
        if (match) {
          this.stats.dynamicMatches++;
          const params: RequestParams = {};

          // Optimized parameter extraction
          if (route.paramNames && match.length > 1) {
            const paramCount = Math.min(route.paramNames.length, match.length - 1);
            for (let i = 0; i < paramCount; i++) {
              const paramName = route.paramNames[i];
              const paramValue = match[i + 1];
              if (paramName && paramValue !== undefined) {
                params[paramName] = decodeURIComponent(paramValue);
              }
            }
          }

          return {
            handler: route.handler,
            params,
          };
        }
      }
    }

    return null;
  }

  /**
   * Cache match results with simple LRU eviction
   */
  private cacheResult(key: string, result: RouteMatch | null): void {
    if (this.cachedMatches.size >= this.cacheMaxSize) {
      // Simple LRU: remove first entry
      const firstKey = this.cachedMatches.keys().next().value;
      if (firstKey) {
        this.cachedMatches.delete(firstKey);
      }
    }
    
    this.cachedMatches.set(key, result);
  }

  // ===== Express-compatible HTTP methods =====

  /**
   * Add GET route
   */
  get(path: string, handler: RouteHandler): VoltrixRouter {
    this.routerRoutes.push({ method: 'GET', path, handler });
    return this;
  }

  /**
   * Add POST route
   */
  post(path: string, handler: RouteHandler): VoltrixRouter {
    this.routerRoutes.push({ method: 'POST', path, handler });
    return this;
  }

  /**
   * Add PUT route
   */
  put(path: string, handler: RouteHandler): VoltrixRouter {
    this.routerRoutes.push({ method: 'PUT', path, handler });
    return this;
  }

  /**
   * Add DELETE route
   */
  delete(path: string, handler: RouteHandler): VoltrixRouter {
    this.routerRoutes.push({ method: 'DELETE', path, handler });
    return this;
  }

  /**
   * Add PATCH route
   */
  patch(path: string, handler: RouteHandler): VoltrixRouter {
    this.routerRoutes.push({ method: 'PATCH', path, handler });
    return this;
  }

  /**
   * Add OPTIONS route
   */
  options(path: string, handler: RouteHandler): VoltrixRouter {
    this.routerRoutes.push({ method: 'OPTIONS', path, handler });
    return this;
  }

  /**
   * Add HEAD route
   */
  head(path: string, handler: RouteHandler): VoltrixRouter {
    this.routerRoutes.push({ method: 'HEAD', path, handler });
    return this;
  }

  /**
   * Add middleware (overloaded method)
   */
  use(middleware: Middleware): VoltrixRouter;
  use(path: string, middleware: Middleware): VoltrixRouter;
  use(path: string, router: VoltrixRouter): VoltrixRouter;
  use(
    pathOrMiddleware: string | Middleware,
    middlewareOrRouter?: Middleware | VoltrixRouter
  ): VoltrixRouter {
    if (typeof pathOrMiddleware === 'string') {
      // use(path, middleware) or use(path, router)
      this.middlewares.push({
        path: pathOrMiddleware,
        middleware: middlewareOrRouter as Middleware | VoltrixRouter,
      });
    } else {
      // use(middleware)
      this.middlewares.push({
        middleware: pathOrMiddleware as Middleware,
      });
    }
    return this;
  }

  /**
   * Get all routes defined in this router
   * Used internally by App to register routes
   */
  getRoutes(): Array<{
    method: string;
    path: string;
    handler: RouteHandler;
  }> {
    return [...this.routerRoutes];
  }

  /**
   * Get all middlewares defined in this router
   * Used internally by App to register middlewares
   */
  getMiddlewares(): Array<{
    path?: string;
    middleware: Middleware | VoltrixRouter;
  }> {
    return [...this.middlewares];
  }

  /**
   * Get comprehensive performance statistics
   */
  getStats(): {
    staticRoutes: number;
    dynamicRoutes: number;
    totalRoutes: number;
    routes: number;
    middlewares: number;
    cacheSize: number;
    performance: {
      cacheHits: number;
      cacheMisses: number;
      cacheHitRatio: number;
      staticMatches: number;
      dynamicMatches: number;
    };
  } {
    const totalRequests = this.stats.cacheHits + this.stats.cacheMisses;
    return {
      staticRoutes: this.staticRoutes.size,
      dynamicRoutes: this.routes.length,
      totalRoutes: this.staticRoutes.size + this.routes.length,
      routes: this.routerRoutes.length,
      middlewares: this.middlewares.length,
      cacheSize: this.cachedMatches.size,
      performance: {
        cacheHits: this.stats.cacheHits,
        cacheMisses: this.stats.cacheMisses,
        cacheHitRatio: totalRequests > 0 ? this.stats.cacheHits / totalRequests : 0,
        staticMatches: this.stats.staticMatches,
        dynamicMatches: this.stats.dynamicMatches,
      },
    };
  }
}

/**
 * Factory function to create a new router (Express-compatible)
 */
export function createRouter(): Router {
  return new Router();
}