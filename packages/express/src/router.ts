import type { WebSocketBehavior } from "uWebSockets.js";
import type { Middleware, ErrorMiddleware, HandlerFunction } from './types/handlers.js';

export interface RouterConfig {
  prefix: string;
  middlewares: Middleware[];
  errorHandlers: ErrorMiddleware[];
  routes: RouteConfig[];
  wsRoutes: WsRouteConfig[];
  childRouters: Map<string, Router>;
}

export interface RouteConfig {
  method: string;
  pattern: string;
  handler: HandlerFunction;
  middlewares: Middleware[];
}

export interface WsRouteConfig {
  pattern: string;
  behavior: WebSocketBehavior<any>;
}

export class Router {
  private prefix: string;
  private middlewares: Middleware[] = [];
  private errorHandlers: ErrorMiddleware[] = [];
  private routes: RouteConfig[] = [];
  private wsRoutes: WsRouteConfig[] = [];
  private childRouters: Map<string, Router> = new Map();

  constructor(prefix = '') {
    this.prefix = prefix;
  }

  // ========================================
  // REGISTRATION
  // ========================================

  use(
    pathOrMiddleware: string | Middleware | Router,
    middlewareOrRouter?: Middleware | Router
  ): this {
    if (typeof pathOrMiddleware === 'function') {
      this.middlewares.push(pathOrMiddleware);
      return this;
    }

    if (pathOrMiddleware instanceof Router) {
      this.childRouters.set('', pathOrMiddleware);
      return this;
    }

    if (typeof pathOrMiddleware === 'string') {
      if (middlewareOrRouter instanceof Router) {
        middlewareOrRouter.setPrefix(pathOrMiddleware);
        this.childRouters.set(pathOrMiddleware, middlewareOrRouter);
      } else if (typeof middlewareOrRouter === 'function') {
        // Middleware asociado a una ruta específica
        this.routes.push({
          method: 'MIDDLEWARE',
          pattern: pathOrMiddleware,
          handler: middlewareOrRouter as HandlerFunction,
          middlewares: [],
        });
      }
    }

    return this;
  }

  useError(handler: ErrorMiddleware): this {
    this.errorHandlers.push(handler);
    return this;
  }

  // ========================================
  // HTTP ROUTES
  // ========================================

  private addRoute(
    method: string,
    pattern: string,
    handlers: (Middleware | HandlerFunction)[]
  ): this {
    const last = handlers.length - 1;
    const middlewares = last > 0 ? (handlers.slice(0, last) as Middleware[]) : [];
    const handler = handlers[last] as HandlerFunction;
    this.routes.push({ method, pattern, handler, middlewares });
    return this;
  }

  get(pattern: string, ...handlers: HandlerFunction[]): this {
    return this.addRoute('GET', pattern, handlers);
  }

  post(pattern: string, ...handlers: HandlerFunction[]): this {
    return this.addRoute('POST', pattern, handlers);
  }

  put(pattern: string, ...handlers: HandlerFunction[]): this {
    return this.addRoute('PUT', pattern, handlers);
  }

  delete(pattern: string, ...handlers: HandlerFunction[]): this {
    return this.addRoute('DELETE', pattern, handlers);
  }

  patch(pattern: string, ...handlers: HandlerFunction[]): this {
    return this.addRoute('PATCH', pattern, handlers);
  }

  options(pattern: string, ...handlers: HandlerFunction[]): this {
    return this.addRoute('OPTIONS', pattern, handlers);
  }

  head(pattern: string, ...handlers: HandlerFunction[]): this {
    return this.addRoute('HEAD', pattern, handlers);
  }

  any(pattern: string, ...handlers: HandlerFunction[]): this {
    return this.addRoute('ANY', pattern, handlers);
  }

  // ========================================
  // WEBSOCKET ROUTES
  // ========================================

  ws(pattern: string, behavior: WebSocketBehavior<any>): this {
    this.wsRoutes.push({ pattern, behavior });
    return this;
  }

  getWsRoutes(): WsRouteConfig[] {
    return this.wsRoutes;
  }

  // ========================================
  // CONFIGURATION ACCESS
  // ========================================

  getConfig(): RouterConfig {
    return {
      prefix: this.prefix,
      middlewares: this.middlewares,
      errorHandlers: this.errorHandlers,
      routes: this.routes,
      wsRoutes: this.wsRoutes,
      childRouters: this.childRouters,
    };
  }

  setPrefix(prefix: string): void {
    this.prefix = prefix;
  }

  // ========================================
  // FLATTENED ROUTE COMPUTATION
  // ========================================

  getFlattenedRoutes(parentPrefix = '') {
    const fullPrefix = this.joinPaths(parentPrefix, this.prefix);
    const results: Array<{
      method: string;
      fullPattern: string;
      handler: HandlerFunction;
      middlewares: Middleware[];
      allMiddlewares: Middleware[];
      errorHandlers: ErrorMiddleware[];
    }> = [];

    const inheritedMws = this.middlewares;
    const inheritedErrs = this.errorHandlers;

    // Rutas locales
    for (let i = 0; i < this.routes.length; i++) {
      const r = this.routes[i];
      if (!r || r.method === 'MIDDLEWARE') continue;
      results.push({
        method: r.method,
        fullPattern: this.joinPaths(fullPrefix, r.pattern),
        handler: r.handler,
        middlewares: r.middlewares,
        allMiddlewares:
          inheritedMws.length > 0
            ? [...inheritedMws, ...(r.middlewares.length ? r.middlewares : [])]
            : r.middlewares,
        errorHandlers: inheritedErrs,
      });
    }

    // Routers hijos
    if (this.childRouters.size > 0) {
      for (const [, child] of this.childRouters) {
        const subRoutes = child.getFlattenedRoutes(fullPrefix);
        if (subRoutes.length > 0) {
          for (let i = 0; i < subRoutes.length; i++) {
            const sr = subRoutes[i];
            if (!sr) continue;
            if (inheritedMws.length) sr.allMiddlewares = [...inheritedMws, ...sr.allMiddlewares];
            if (inheritedErrs.length) sr.errorHandlers = [...inheritedErrs, ...sr.errorHandlers];
          }
          results.push(...subRoutes);
        }
      }
    }

    return results;
  }

  // ========================================
  // PATH MIDDLEWARE LOOKUP (if needed)
  // ========================================

  getPathMiddlewares(parentPrefix = '') {
    const fullPrefix = this.joinPaths(parentPrefix, this.prefix);
    const list: Array<{ fullPattern: string; middlewares: Middleware[] }> = [];

    for (let i = 0; i < this.routes.length; i++) {
      const r = this.routes[i];
      if (!r) continue;

      if (r.method === 'MIDDLEWARE') {
        list.push({
          fullPattern: this.joinPaths(fullPrefix, r.pattern),
          middlewares: [r.handler as Middleware],
        });
      }
    }

    for (const [, childRouter] of this.childRouters) {
      const child = childRouter.getPathMiddlewares(fullPrefix);
      if (child.length) list.push(...child);
    }

    return list;
  }

  // ========================================
  // UTILITIES
  // ========================================

  private joinPaths(parent: string, child: string): string {
    if (!parent) return child.startsWith('/') ? child : `/${child}`;
    if (!child) return parent;
    const p = parent.endsWith('/') ? parent.slice(0, -1) : parent;
    const c = child.startsWith('/') ? child : `/${child}`;
    return p + c;
  }

  getStats() {
    return {
      prefix: this.prefix,
      routes: this.routes.length,
      wsRoutes: this.wsRoutes.length,
      middlewares: this.middlewares.length,
      errorHandlers: this.errorHandlers.length,
      childRouters: this.childRouters.size,
    };
  }
}

// ========================================
// Factory
// ========================================
export const createRouter = (prefix = '') => new Router(prefix);
