import {
  App as UWSApp,
  type TemplatedApp,
  type HttpRequest,
  type HttpResponse,
  type WebSocketBehavior,
  us_listen_socket,
} from 'uWebSockets.js';
import { LRUCache } from './common/lru-cache.js';
import { RouteLRUCache } from './common/route-cache.js';
import { Router } from './router.js';
import type {
  Middleware as MiddlewareFunction,
  ErrorMiddleware as ErrorMiddlewareFunction,
  HandlerFunction,
} from './types/handlers.js';
import { QueryParser, Request } from './http/request.js';
import { Response } from './http/response.js';
import { Renderer } from './renderer.js';

interface CompiledHandler {
  middlewares: MiddlewareFunction[];
  handler: HandlerFunction;
  hasMiddleware: boolean;
}

export class Voltrix extends Renderer {
  readonly uws: TemplatedApp;
  private readonly handlerCache: LRUCache<CompiledHandler>;
  private readonly routeCache: RouteLRUCache;

  private globalMiddlewares: MiddlewareFunction[] = [];
  private errorHandlers: ErrorMiddlewareFunction[] = [];
  private notFoundHandler: HandlerFunction | null = null;
  private hasGlobalMiddleware = false;

  private listenSocket: any = null;

  private stats = {
    cacheHits: 0,
    cacheMisses: 0,
    totalRequests: 0,
  };

  constructor(cacheSize = 1000, cacheTTL = 30_000, routeCacheSize = 500, routeCacheTTL = 300_000) {
    super();
    this.uws = UWSApp();
    this.handlerCache = new LRUCache(cacheSize, cacheTTL);
    this.routeCache = new RouteLRUCache(routeCacheSize, routeCacheTTL);
  }

  // =========================
  // Registration / Composition
  // =========================
  use(arg1: string | MiddlewareFunction | Router, arg2?: MiddlewareFunction | Router): this {
    if (typeof arg1 === 'function') {
      this.globalMiddlewares.push(arg1);
      this.hasGlobalMiddleware = true;
      this.handlerCache.clear();
    } else if (arg1 instanceof Router) {
      this.integrateRouter('', arg1);
    } else if (typeof arg1 === 'string') {
      if (arg2 instanceof Router) this.integrateRouter(arg1, arg2);
    }
    return this;
  }

  useError(errorHandler: ErrorMiddlewareFunction): this {
    this.errorHandlers.push(errorHandler);
    return this;
  }

  useNotFound(notFoundHandler: HandlerFunction): this {
    this.notFoundHandler = notFoundHandler;
    return this;
  }

  // =========================
  // HTTP verbs (direct uWS)
  // =========================
  get(pattern: string, handler: HandlerFunction): this {
    this.uws.get(pattern, (res, req) => this.handleRequest(pattern, req, res, handler));
    return this;
  }
  
  post(pattern: string, handler: HandlerFunction): this {
    this.uws.post(pattern, (res, req) => this.handleRequest(pattern, req, res, handler));
    return this;
  }
  put(pattern: string, handler: HandlerFunction): this {
    this.uws.put(pattern, (res, req) => this.handleRequest(pattern, req, res, handler));
    return this;
  }
  delete(pattern: string, handler: HandlerFunction): this {
    this.uws.del(pattern, (res, req) => this.handleRequest(pattern, req, res, handler));
    return this;
  }
  patch(pattern: string, handler: HandlerFunction): this {
    this.uws.patch(pattern, (res, req) => this.handleRequest(pattern, req, res, handler));
    return this;
  }
  options(pattern: string, handler: HandlerFunction): this {
    this.uws.options(pattern, (res, req) => this.handleRequest(pattern, req, res, handler));
    return this;
  }
  head(pattern: string, handler: HandlerFunction): this {
    this.uws.head(pattern, (res, req) => this.handleRequest(pattern, req, res, handler));
    return this;
  }
  any(pattern: string, handler: HandlerFunction): this {
    this.uws.any(pattern, (res, req) => this.handleRequest(pattern, req, res, handler));
    return this;
  }

  // =========================
  // Router integration (HTTP + WS)
  // =========================
  private integrateRouter(prefix: string, router: Router): void {
    const flattened = router.getFlattenedRoutes(prefix);
    const wsRoutes = (router as any).getWsRoutes?.() ?? [];

    // HTTP
    for (const route of flattened) {
      const { method, fullPattern, handler, allMiddlewares, errorHandlers } = route;

      const compiledHandler = (res: HttpResponse, req: HttpRequest) => {
        const enhancedReq = new Request(req, fullPattern);
        const enhancedRes = new Response(res, this);

        const combined =
          this.hasGlobalMiddleware && this.globalMiddlewares.length
            ? [...this.globalMiddlewares, ...allMiddlewares]
            : allMiddlewares;

        if (combined.length > 0) {
          this.executeRouterMiddlewareChain(
            enhancedReq,
            enhancedRes,
            handler,
            combined,
            errorHandlers
          );
        } else {
          try {
            const r = handler(enhancedReq, enhancedRes);
            if (r && typeof (r as Promise<any>).catch === 'function') {
              (r as Promise<any>).catch(err => this.handleError(err, enhancedReq, enhancedRes));
            }
          } catch (err) {
            this.handleError(err, enhancedReq, enhancedRes);
          }
        }
      };

      switch (method) {
        case 'GET':
          this.uws.get(fullPattern, compiledHandler);
          break;
        case 'POST':
          this.uws.post(fullPattern, compiledHandler);
          break;
        case 'PUT':
          this.uws.put(fullPattern, compiledHandler);
          break;
        case 'DELETE':
          this.uws.del(fullPattern, compiledHandler);
          break;
        case 'PATCH':
          this.uws.patch(fullPattern, compiledHandler);
          break;
        case 'OPTIONS':
          this.uws.options(fullPattern, compiledHandler);
          break;
        case 'HEAD':
          this.uws.head(fullPattern, compiledHandler);
          break;
        case 'ANY':
          this.uws.any(fullPattern, compiledHandler);
          break;
      }
    }

    // WebSocket
    for (const ws of wsRoutes) {
      const fullPath =
        (prefix && prefix !== '/' ? (prefix.endsWith('/') ? prefix.slice(0, -1) : prefix) : '') +
        (ws.pattern.startsWith('/') ? ws.pattern : `/${ws.pattern}`);
      this.uws.ws(fullPath, ws.behavior as WebSocketBehavior<any>);
    }

    this.handlerCache.clear();
  }

  private executeRouterMiddlewareChain(
    req: Request,
    res: Response,
    handler: HandlerFunction,
    middlewares: MiddlewareFunction[],
    errorHandlers: ErrorMiddlewareFunction[]
  ): void {
    const total = middlewares.length;
    let i = 0;

    const bubbleError = (err: any) => {
      if (errorHandlers.length === 0) return this.handleError(err, req, res);
      let ei = 0;
      const nextErr = (): void => {
        if (ei >= errorHandlers.length) return this.handleError(err, req, res);
        try {
          const fn = errorHandlers[ei++] as ErrorMiddlewareFunction;
          fn(err, req, res, nextErr);
        } catch {
          nextErr();
        }
      };
      nextErr();
    };

    const next = (err?: any): void => {
      if (err) return bubbleError(err);

      while (i < total) {
        try {
          const mw = middlewares[i++] as MiddlewareFunction;
          const r = mw(req, res, next);
          if (r && typeof (r as Promise<any>).catch === 'function') {
            (r as Promise<any>).catch(bubbleError);
            return;
          }
        } catch (e) {
          return bubbleError(e);
        }
      }

      try {
        const r = handler(req, res);
        if (r && typeof (r as Promise<any>).catch === 'function') {
          (r as Promise<any>).catch(bubbleError);
        }
      } catch (e) {
        bubbleError(e);
      }
    };

    next();
  }

  // =========================
  // Core execution / errors
  // =========================
  private compileHandler(handler: HandlerFunction): CompiledHandler {
    return {
      middlewares: this.globalMiddlewares.length ? [...this.globalMiddlewares] : [],
      handler,
      hasMiddleware: this.hasGlobalMiddleware,
    };
  }

  private executeWithMiddleware(req: Request, res: Response, compiled: CompiledHandler): void {
    const { middlewares, handler } = compiled;
    const total = middlewares.length;
    let i = 0;

    const handleError = (err: any) => this.handleError(err, req, res);

    const next = (err?: any): void => {
      if (err) return handleError(err);

      if (i >= total) {
        try {
          const result = handler(req, res);
          if (result && typeof (result as Promise<any>).catch === 'function') {
            (result as Promise<any>).catch(handleError);
          }
        } catch (e) {
          handleError(e);
        }
        return;
      }

      const mw = middlewares[i++] as MiddlewareFunction;
      try {
        const r = mw(req, res, next);
        if (r && typeof (r as Promise<any>).catch === 'function') {
          (r as Promise<any>).catch(handleError);
        }
      } catch (e) {
        handleError(e);
      }
    };

    next();
  }

  private handleError(error: any, req: Request, res: Response): void {
    if (this.errorHandlers.length === 0) {
      console.error('Unhandled error in request:', error);
      if (!res.headersSent && !res.isAborted) res.status(500).send('Internal Server Error');
      return;
    }

    let i = 0;
    const next = (): void => {
      const handler = this.errorHandlers[i++];
      if (!handler) {
        if (!res.headersSent && !res.isAborted)
          res.status(500).json({ error: 'Internal Server Error' });
        return;
      }

      try {
        const result = handler(error, req, res, next);

        if (result instanceof Promise) {
          result.then(undefined, next);
          return;
        }

        if (res.headersSent || res.isAborted) {
          return;
        }
      } catch (err) {
        next();
      }
    };

    next();
  }

  private async handleRequest(
    pattern: string,
    uwsReq: HttpRequest,
    uwsRes: HttpResponse,
    handler: HandlerFunction
  ) {
    this.stats.totalRequests++;

    const method = uwsReq.getMethod().toUpperCase();
    const path = uwsReq.getUrl();
    const routeKey = { method, path };
    const cached = this.routeCache.get(routeKey);
    
    if (cached) {
      uwsRes.cork(() => {
        uwsRes.writeStatus(cached.statusCode.toString());
        for (const [k, v] of Object.entries(cached.headers)) uwsRes.writeHeader(k, v as string);
        uwsRes.end(cached.body);
      });
      return;
    }

    const cacheKey = `${method}:${pattern}`;
    let compiled = this.handlerCache.get(cacheKey);

    if (!compiled) {
      this.stats.cacheMisses++;
      compiled = this.compileHandler(handler);
      this.handlerCache.set(cacheKey, compiled);
    } else {
      this.stats.cacheHits++;
    }

    const req = new Request(uwsReq, pattern);
    const res = new Response(uwsRes, this);

    try {
      if (compiled.hasMiddleware) this.executeWithMiddleware(req, res, compiled);
      else {
        const result = handler(req, res);
        if (result && typeof (result as Promise<any>).catch === 'function') {
          (result as Promise<any>).catch(err => this.handleError(err, req, res));
        }
      }
    } catch (err) {
      this.handleError(err, req, res);
    }
  }

  private setupNotFoundHandler(): void {
    if (!this.notFoundHandler) return;
    this.uws.any('/*', (res, req) => {
      this.notFoundHandler!(new Request(req, req.getUrl()), new Response(res, this));
    });
  }

  // =========================
  // Server lifecycle / passthrough
  // =========================
  listen(port: number, callback?: (sock: us_listen_socket) => void) {
    return new Promise<us_listen_socket>((resolve, reject) => {
      this.setupNotFoundHandler();
      this.uws.listen(port, sock => {
        if (!sock) {
          reject(new Error(`Failed to listen on port ${port}`));
          return;
        }

        this.listenSocket = sock;
        callback?.(sock);
        resolve(sock);
      });
      return this.listenSocket;
    });
  }

  close(): Promise<void> {
    return new Promise(resolve => {
      if (this.listenSocket) {
        this.uws.close();
        this.listenSocket = null;
      }
      setTimeout(resolve, 10);
    });
  }

  ws(pattern: string, behavior: WebSocketBehavior<any>) {
    this.uws.ws(pattern, behavior);
    return this;
  }

  // =========================
  // Caches / Stats
  // =========================
  clearAllCaches(): void {
    this.handlerCache.clear();
    this.routeCache.clear();
  }

  clearHandlerCache(): void {
    this.handlerCache.clear();
  }

  clearRouteCache(): void {
    this.routeCache.clear();
  }

  getStats() {
    const r = this.routeCache.getStats();
    return {
      ...this.stats,
      routeCache: r,
      handlerCacheSize: this.handlerCache.size(),
    };
  }

  //////////////////////////
  /// Statics methods
  /////////////////////////

  static setQueryParser(parser: QueryParser) {
    Request.setQueryParser(parser);
  }
}

export const voltrix = (opts?: {
  cacheSize?: number;
  cacheTTL?: number;
  routeCacheSize?: number;
  routeCacheTTL?: number;
}) => new Voltrix(opts?.cacheSize, opts?.cacheTTL, opts?.routeCacheSize, opts?.routeCacheTTL);

export default voltrix;
