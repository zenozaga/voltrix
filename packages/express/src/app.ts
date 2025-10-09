import { App as UWSApp, HttpRequest, HttpResponse } from 'uWebSockets.js';
import { Router } from './router.js';
import { Request } from './request.js';
import { Response } from './response.js';
import type {
  VoltrixApp,
  VoltrixRouter,
  RouteHandler,
  Middleware,
  ErrorMiddleware,
  NextFunction,
  MiddlewareEntry,
  AppStats,
  NotFoundHandler,
  GlobalErrorHandler,
  WebSocketRoute,
  WebSocketUpgradeHandler,
  WebSocketOpenHandler,
  WebSocketMessageHandler,
  WebSocketCloseHandler,
  WebSocket,
  WebSocketData,
} from './types.js';

export class App extends Router implements VoltrixApp {
  private readonly uws: ReturnType<typeof UWSApp>;
  private readonly appMiddlewares: MiddlewareEntry[] = [];
  private readonly errorHandlers: ErrorMiddleware[] = [];
  private globalErrorHandlers: GlobalErrorHandler[] = [];
  private notFoundHandlers: NotFoundHandler[] = [];
  
  // WebSocket support
  private readonly wsRoutes: WebSocketRoute[] = [];
  private activeConnections = new Set<WebSocket>();

  constructor() {
    super(); // Call Router constructor
    this.uws = UWSApp();
    this.setupUWSHandlers();
  }

  /**
   * Setup uWebSockets.js route handlers for all HTTP methods
   */
  private setupUWSHandlers(): void {
    this.uws.get('/*', (res: HttpResponse, req: HttpRequest) => {
      this.handleRequest('GET', res, req);
    });

    this.uws.post('/*', (res: HttpResponse, req: HttpRequest) => {
      this.handleRequest('POST', res, req);
    });

    this.uws.put('/*', (res: HttpResponse, req: HttpRequest) => {
      this.handleRequest('PUT', res, req);
    });

    this.uws.del('/*', (res: HttpResponse, req: HttpRequest) => {
      this.handleRequest('DELETE', res, req);
    });

    this.uws.patch('/*', (res: HttpResponse, req: HttpRequest) => {
      this.handleRequest('PATCH', res, req);
    });

    this.uws.options('/*', (res: HttpResponse, req: HttpRequest) => {
      this.handleRequest('OPTIONS', res, req);
    });

    this.uws.head('/*', (res: HttpResponse, req: HttpRequest) => {
      this.handleRequest('HEAD', res, req);
    });
  }

  /**
   * Handle incoming HTTP request
   */
  private async handleRequest(
    method: string,
    uwsRes: HttpResponse,
    uwsReq: HttpRequest
  ): Promise<void> {
    const req = new Request(uwsReq, method);
    const res = new Response(uwsRes);

    // Handle client disconnection
    let aborted = false;
    uwsRes.onAborted(() => {
      aborted = true;
    });

    try {
      // Execute middleware chain
      await this.executeMiddlewareChain(req, res);

      // If no response sent and not aborted, try to match route
      if (!aborted && !res.finished) {
        const match = this.match(method, req.path); // Use inherited Router.match()

        if (match) {
          // Set route parameters
          Object.assign(req.params, match.params);

          // Execute route handler
          await match.handler(req, res);
        } else {
          // No route found - use custom 404 handlers or default
          if (this.notFoundHandlers.length > 0) {
            // Execute all not found handlers
            for (const notFoundHandler of this.notFoundHandlers) {
              await notFoundHandler(req, res);
              if (res.finished) break;
            }
          } else {
            res.status(404).json({
              error: 'Not Found',
              message: `Cannot ${method} ${req.path}`,
              path: req.path,
              method: method,
            });
          }
        }
      }
    } catch (error) {
      if (!aborted && !res.finished) {
        await this.handleError(error as Error, req, res);
      }
    }
  }

  /**
   * Execute middleware chain
   */
  private async executeMiddlewareChain(req: Request, res: Response): Promise<void> {
    let index = 0;
    const middlewares = this.getApplicableMiddlewares(req.path);

    const next: NextFunction = async (error?: Error) => {
      if (error) {
        throw error;
      }

      if (index >= middlewares.length) {
        return;
      }

      const middleware = middlewares[index++];
      if (middleware) {
        await middleware.handler(req, res, next);
      }
    };

    await next();
  }

  /**
   * Ultra-optimized middleware filtering with caching
   */
  private middlewareCache = new Map<string, MiddlewareEntry[]>();

  private getApplicableMiddlewares(path: string): MiddlewareEntry[] {
    // Cache middleware matches for repeated requests to same paths
    if (this.middlewareCache.has(path)) {
      return this.middlewareCache.get(path)!;
    }

    const applicable: MiddlewareEntry[] = [];

    // Get middlewares from inherited Router and convert to MiddlewareEntry format
    const routerMiddlewares = super.getMiddlewares();
    for (const mw of routerMiddlewares) {
      if (!mw.path || path.startsWith(mw.path)) {
        if (mw.path) {
          applicable.push({
            path: mw.path,
            handler: mw.middleware as Middleware
          });
        } else {
          applicable.push({
            handler: mw.middleware as Middleware
          });
        }
      }
    }

    // Add app-specific middlewares
    for (let i = 0; i < this.appMiddlewares.length; i++) {
      const mw = this.appMiddlewares[i];
      if (mw && (!mw.path || path.startsWith(mw.path))) {
        applicable.push(mw);
      }
    }

    // Cache the result (with simple size limit)
    if (this.middlewareCache.size < 100) {
      // Prevent memory leaks
      this.middlewareCache.set(path, applicable);
    }

    return applicable;
  }

  /**
   * Clear middleware cache when middlewares change
   */
  private clearMiddlewareCache(): void {
    this.middlewareCache.clear();
  }

  /**
   * Ultra-optimized error handling with multiple fallback layers
   */
  private async handleError(error: Error, req: Request, res: Response): Promise<void> {
    try {
      // Level 1: Try global error handlers first (highest priority)
      if (this.globalErrorHandlers.length > 0 && !res.finished) {
        for (const globalErrorHandler of this.globalErrorHandlers) {
          let handled = false;
          const next: NextFunction = () => {
            handled = true;
          };

          await globalErrorHandler(error, req, res, next);

          if (!handled) {
            return; // Global handler took care of it
          }

          if (res.finished) {
            return; // Response was sent
          }
        }
      }

      // Level 2: Try registered error middleware
      for (const errorHandler of this.errorHandlers) {
        try {
          if (res.finished) break;

          let handled = false;
          const next: NextFunction = () => {
            handled = true;
          };

          await errorHandler(error, req, res, next);

          if (!handled) {
            break; // Error handler handled the error
          }
        } catch (handlerError) {
          console.error('🚨 Error in error handler:', handlerError);
          // Continue to next handler or fallback
        }
      }

      // Level 3: Default error handling (last resort)
      if (!res.finished) {
        const isDevelopment =
          typeof process !== 'undefined' && process.env?.NODE_ENV === 'development';

        console.error('🚨 Unhandled error:', {
          message: error.message,
          stack: isDevelopment ? error.stack : '[Stack hidden in production]',
          url: req.url,
          method: req.method,
          timestamp: new Date().toISOString(),
        });

        res.status(500).json({
          error: 'Internal Server Error',
          message: isDevelopment ? error.message : 'Something went wrong',
          timestamp: new Date().toISOString(),
          path: req.path,
          method: req.method,
          ...(isDevelopment && { stack: error.stack }),
        });
      }
    } catch (fatalError) {
      // Ultimate fallback - should never happen
      console.error('🔥 FATAL: Error in error handling system:', fatalError);
      if (!res.finished) {
        try {
          res.status(500).end('Fatal Server Error');
        } catch {
          // If even this fails, there's nothing more we can do
        }
      }
    }
  }

  // Express-compatible HTTP method handlers (overriding Router methods)
  override get(path: string, handler: RouteHandler): VoltrixApp {
    super.get(path, handler); // Use Router's get method
    this.addRoute('GET', path, handler); // Also add to matching engine
    return this;
  }

  override post(path: string, handler: RouteHandler): VoltrixApp {
    super.post(path, handler);
    this.addRoute('POST', path, handler);
    return this;
  }

  override put(path: string, handler: RouteHandler): VoltrixApp {
    super.put(path, handler);
    this.addRoute('PUT', path, handler);
    return this;
  }

  override delete(path: string, handler: RouteHandler): VoltrixApp {
    super.delete(path, handler);
    this.addRoute('DELETE', path, handler);
    return this;
  }

  override patch(path: string, handler: RouteHandler): VoltrixApp {
    super.patch(path, handler);
    this.addRoute('PATCH', path, handler);
    return this;
  }

  override options(path: string, handler: RouteHandler): VoltrixApp {
    super.options(path, handler);
    this.addRoute('OPTIONS', path, handler);
    return this;
  }

  override head(path: string, handler: RouteHandler): VoltrixApp {
    super.head(path, handler);
    this.addRoute('HEAD', path, handler);
    return this;
  }

  /**
   * Register WebSocket route with ultra-fast performance
   */
  ws(path: string, handlers: {
    upgrade?: WebSocketUpgradeHandler;
    open?: WebSocketOpenHandler;
    message?: WebSocketMessageHandler;
    close?: WebSocketCloseHandler;
  }): VoltrixApp {
    // Store WebSocket route configuration
    const wsRoute: WebSocketRoute = {
      pattern: path,
      handlers,
    };
    
    this.wsRoutes.push(wsRoute);
    
    // Setup uWebSockets.js WebSocket handler
    this.uws.ws(path, {
      // Handle upgrade (HTTP -> WebSocket)
      upgrade: async (res, req, context) => {
        try {
          if (handlers.upgrade) {
            const voltrixRes = new Response(res);
            const voltrixReq = new Request(req, 'GET'); // WebSocket upgrades are always GET requests
            await handlers.upgrade(voltrixRes, voltrixReq, context);
          } else {
            // Default upgrade behavior
            res.upgrade(
              { path }, // userData
              req.getHeader('sec-websocket-key'),
              req.getHeader('sec-websocket-protocol'),
              req.getHeader('sec-websocket-extensions'),
              context
            );
          }
        } catch (error) {
          console.error('🚨 WebSocket upgrade error:', error);
          res.writeStatus('400 Bad Request').end();
        }
      },

      // Handle connection open
      open: async (ws) => {
        try {
          this.activeConnections.add(ws as unknown as WebSocket);
          
          if (handlers.open) {
            await handlers.open(ws as unknown as WebSocket);
          }
          
          console.log(`🔗 WebSocket connected: ${path} (${this.activeConnections.size} active)`);
        } catch (error) {
          console.error('🚨 WebSocket open error:', error);
        }
      },

      // Handle incoming messages
      message: async (ws: any, message: ArrayBuffer, opCode: any) => {
        try {
          if (handlers.message) {
            await handlers.message(ws as unknown as WebSocket, message, Number(opCode));
          }
        } catch (error) {
          console.error('🚨 WebSocket message error:', error);
        }
      },

      // Handle connection close
      close: async (ws, code, message) => {
        try {
          this.activeConnections.delete(ws as unknown as WebSocket);
          
          if (handlers.close) {
            await handlers.close(ws as unknown as WebSocket, code, message);
          }
          
          console.log(`🔌 WebSocket disconnected: ${path} (${this.activeConnections.size} active)`);
        } catch (error) {
          console.error('🚨 WebSocket close error:', error);
        }
      },
    });

    return this;
  }

  // Middleware registration (Express-compatible)
  override use(middleware: Middleware): VoltrixApp;
  override use(path: string, middleware: Middleware): VoltrixApp;
  override use(path: string, router: VoltrixRouter): VoltrixApp;
  override use(pathOrMiddleware: string | Middleware, middlewareOrRouter?: Middleware | VoltrixRouter): VoltrixApp {
    // Use inherited Router use() method
    super.use(pathOrMiddleware as any, middlewareOrRouter as any);
    
    // Also add to app middlewares for caching compatibility
    if (typeof pathOrMiddleware === 'function') {
      // Global middleware: app.use(middleware)
      this.appMiddlewares.push({ handler: pathOrMiddleware });
    } else if (typeof pathOrMiddleware === 'string' && middlewareOrRouter) {
      if (this.isRouter(middlewareOrRouter)) {
        // Router mounting: app.use('/api', router)
        this.mountRouter(pathOrMiddleware, middlewareOrRouter);
      } else {
        // Path-specific middleware: app.use('/api', middleware)
        this.appMiddlewares.push({ path: pathOrMiddleware, handler: middlewareOrRouter as Middleware });
      }
    }

    // Clear middleware cache when middlewares change
    this.clearMiddlewareCache();

    return this;
  }

  /**
   * Check if an object is a VoltrixRouter
   */
  private isRouter(obj: any): obj is import('./types.js').VoltrixRouter {
    return obj && 
           typeof obj.get === 'function' &&
           typeof obj.post === 'function' &&
           typeof obj.getRoutes === 'function' &&
           typeof obj.getMiddlewares === 'function';
  }

  /**
   * Mount a router at a specific path
   */
  private mountRouter(basePath: string, router: import('./types.js').VoltrixRouter): void {
    const routerInstance = router as any;
    
    // Mount all routes from the router
    const routes = routerInstance.getRoutes();
    for (const route of routes) {
      const fullPath = this.combinePaths(basePath, route.path);
      this.addRoute(route.method as any, fullPath, route.handler); // Use inherited addRoute
    }
    
    // Mount all middlewares from the router  
    const middlewares = routerInstance.getMiddlewares();
    for (const middlewareEntry of middlewares) {
      if (middlewareEntry.path) {
        // Path-specific middleware in router
        const fullPath = this.combinePaths(basePath, middlewareEntry.path);
        if (this.isRouter(middlewareEntry.middleware)) {
          this.mountRouter(fullPath, middlewareEntry.middleware);
        } else {
          this.appMiddlewares.push({ 
            path: fullPath, 
            handler: middlewareEntry.middleware as Middleware 
          });
        }
      } else {
        // Global middleware in router (applies to basePath)
        if (this.isRouter(middlewareEntry.middleware)) {
          this.mountRouter(basePath, middlewareEntry.middleware);
        } else {
          this.appMiddlewares.push({ 
            path: basePath, 
            handler: middlewareEntry.middleware as Middleware 
          });
        }
      }
    }
  }

  /**
   * Combine paths utility
   */
  private combinePaths(basePath: string, routePath: string): string {
    const normalizeBasePath = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;
    const normalizeRoutePath = routePath.startsWith('/') ? routePath : `/${routePath}`;
    
    if (normalizeBasePath === '' || normalizeBasePath === '/') {
      return normalizeRoutePath;
    }
    
    return normalizeBasePath + normalizeRoutePath;
  }

  /**
   * Add error handling middleware
   */
  useErrorHandler(handler: ErrorMiddleware): VoltrixApp {
    this.errorHandlers.push(handler);
    // Error handlers don't affect middleware cache, so no need to clear
    return this;
  }

  // Server lifecycle
  listen(port: number, callback?: (success: boolean) => void): void;
  listen(port: number, host: string, callback?: (success: boolean) => void): void;
  listen(
    port: number,
    hostOrCallback?: string | ((success: boolean) => void),
    callback?: (success: boolean) => void
  ): void {
    let host = '0.0.0.0';
    let cb = callback;

    if (typeof hostOrCallback === 'string') {
      host = hostOrCallback;
    } else if (typeof hostOrCallback === 'function') {
      cb = hostOrCallback;
    }

    this.uws.listen(host, port, (listenSocket: unknown) => {
      const success = !!listenSocket;

      if (success) {
        console.log(`🚀 Voltrix server listening on ${host}:${port}`);
      } else {
        console.error(`❌ Failed to listen on ${host}:${port}`);
      }

      if (cb) {
        cb(success);
      }
    });
  }

  /**
   * Graceful shutdown
   */
  close(): void {
    // uWebSockets.js doesn't expose a close method directly
    // In production, you'd typically handle this through process signals
    console.log('🔄 Shutting down Voltrix server...');
  }

  /**
   * Add global error handler for uncaught errors (multiple handlers supported)
   */
  onError(handler: GlobalErrorHandler): VoltrixApp {
    this.globalErrorHandlers.push(handler);
    return this;
  }

  /**
   * Add 404 Not Found handler (multiple handlers supported)
   */
  onNotFound(handler: NotFoundHandler): VoltrixApp {
    this.notFoundHandlers.push(handler);
    return this;
  }

  /**
   * Get application statistics (implements VoltrixApp interface)
   */
  getAppStats(): AppStats {
    const routerStats = super.getStats(); // Get stats from inherited Router
    
    return {
      routes: {
        totalRoutes: routerStats.totalRoutes,
        staticRoutes: routerStats.staticRoutes,
        paramRoutes: routerStats.dynamicRoutes,
        wildcardRoutes: 0, // Router doesn't track wildcards separately yet
      },
      middleware: {
        globalMiddleware: this.appMiddlewares.length + routerStats.middlewares,
        routeMiddleware: this.errorHandlers.length,
      },
      websockets: {
        totalWebSockets: this.wsRoutes.length,
        activeConnections: this.activeConnections.size,
      },
    };
  }

  /**
   * Get stats for VoltrixApp compatibility (required by interface)
   */
  override getStats(): any {
    // Return AppStats for VoltrixApp interface
    const routerStats = super.getStats();
    
    return {
      // VoltrixApp AppStats format
      routes: {
        totalRoutes: routerStats.totalRoutes,
        staticRoutes: routerStats.staticRoutes,
        paramRoutes: routerStats.dynamicRoutes,
        wildcardRoutes: 0,
      },
      middleware: {
        globalMiddleware: this.appMiddlewares.length + routerStats.middlewares,
        routeMiddleware: this.errorHandlers.length,
      },
      websockets: {
        totalWebSockets: this.wsRoutes.length,
        activeConnections: this.activeConnections.size,
      },
      // Router stats compatibility
      staticRoutes: routerStats.staticRoutes,
      dynamicRoutes: routerStats.dynamicRoutes,
      totalRoutes: routerStats.totalRoutes,
      middlewares: routerStats.middlewares,
      cacheSize: routerStats.cacheSize,
      performance: routerStats.performance,
    };
  }

  /**
   * Get router stats specifically
   */
  getRouterStats() {
    return super.getStats();
  }
}
