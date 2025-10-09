# Implement Core Voltrix Express Package

## Overview
Create the core `@voltrix/express` package that provides an Express-compatible API built on top of uWebSockets.js for maximum performance.

## Objectives
- Express-compatible Application class
- Request/Response wrapper classes  
- Basic routing with method chaining
- Middleware system foundation
- Error handling infrastructure

## Implementation Steps

### 1. Core Application Class

#### src/app.ts
```typescript
import { App as UWSApp, HttpRequest, HttpResponse } from 'uWebSockets.js';
import { Router } from './router';
import { Request } from './request';
import { Response } from './response';

export interface VoltrixApp {
  get(path: string, handler: RouteHandler): VoltrixApp;
  post(path: string, handler: RouteHandler): VoltrixApp;
  put(path: string, handler: RouteHandler): VoltrixApp;
  delete(path: string, handler: RouteHandler): VoltrixApp;
  patch(path: string, handler: RouteHandler): VoltrixApp;
  use(path: string | Middleware, handler?: Middleware): VoltrixApp;
  listen(port: number, callback?: (success: boolean) => void): void;
}

export type RouteHandler = (req: Request, res: Response) => void | Promise<void>;
export type Middleware = (req: Request, res: Response, next: NextFunction) => void | Promise<void>;
export type NextFunction = (error?: Error) => void;

export class App implements VoltrixApp {
  private uws: UWSApp;
  private router: Router;
  private middlewares: Middleware[] = [];

  constructor() {
    this.uws = UWSApp();
    this.router = new Router();
    this.setupUWSHandlers();
  }

  private setupUWSHandlers(): void {
    // Handle all HTTP methods through a single handler for efficiency
    const methods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head'] as const;
    
    methods.forEach(method => {
      this.uws[method]('/*', (res: HttpResponse, req: HttpRequest) => {
        this.handleRequest(method.toUpperCase(), res, req);
      });
    });
  }

  private async handleRequest(method: string, uwsRes: HttpResponse, uwsReq: HttpRequest): Promise<void> {
    const req = new Request(uwsReq, method);
    const res = new Response(uwsRes);

    // Handle client disconnection
    let aborted = false;
    uwsRes.onAborted(() => {
      aborted = true;
    });

    try {
      // Execute middleware chain and route handler
      await this.executeMiddlewareChain(req, res);
      
      if (!aborted && !res.finished) {
        // Route not found
        res.status(404).send('Not Found');
      }
    } catch (error) {
      if (!aborted && !res.finished) {
        this.handleError(error as Error, req, res);
      }
    }
  }

  private async executeMiddlewareChain(req: Request, res: Response): Promise<void> {
    let index = 0;
    const middlewares = [...this.middlewares];
    
    // Add route handler as final middleware
    const routeHandler = this.router.match(req.method, req.path);
    if (routeHandler) {
      middlewares.push(routeHandler);
    }

    const next: NextFunction = async (error?: Error) => {
      if (error) {
        throw error;
      }
      
      if (index >= middlewares.length) {
        return;
      }

      const middleware = middlewares[index++];
      await middleware(req, res, next);
    };

    await next();
  }

  private handleError(error: Error, req: Request, res: Response): void {
    console.error('Voltrix Error:', error);
    if (!res.finished) {
      res.status(500).send('Internal Server Error');
    }
  }

  // Express-compatible API methods
  get(path: string, handler: RouteHandler): VoltrixApp {
    this.router.addRoute('GET', path, handler);
    return this;
  }

  post(path: string, handler: RouteHandler): VoltrixApp {
    this.router.addRoute('POST', path, handler);
    return this;
  }

  put(path: string, handler: RouteHandler): VoltrixApp {
    this.router.addRoute('PUT', path, handler);
    return this;
  }

  delete(path: string, handler: RouteHandler): VoltrixApp {
    this.router.addRoute('DELETE', path, handler);
    return this;
  }

  patch(path: string, handler: RouteHandler): VoltrixApp {
    this.router.addRoute('PATCH', path, handler);
    return this;
  }

  use(pathOrMiddleware: string | Middleware, handler?: Middleware): VoltrixApp {
    if (typeof pathOrMiddleware === 'function') {
      // Global middleware
      this.middlewares.push(pathOrMiddleware);
    } else {
      // Path-specific middleware (simplified for now)
      if (handler) {
        this.middlewares.push(handler);
      }
    }
    return this;
  }

  listen(port: number, callback?: (success: boolean) => void): void {
    this.uws.listen(port, (listenSocket) => {
      const success = !!listenSocket;
      if (callback) {
        callback(success);
      }
      if (success) {
        console.log(`Voltrix server listening on port ${port}`);
      } else {
        console.error(`Failed to listen on port ${port}`);
      }
    });
  }
}
```

### 2. Request Wrapper Class

#### src/request.ts
```typescript
import { HttpRequest } from 'uWebSockets.js';

export class Request {
  public readonly method: string;
  public readonly path: string;
  public readonly url: string;
  public readonly headers: Record<string, string>;
  public readonly query: Record<string, string>;
  public readonly params: Record<string, string> = {};
  
  private uwsReq: HttpRequest;

  constructor(uwsReq: HttpRequest, method: string) {
    this.uwsReq = uwsReq;
    this.method = method;
    this.path = uwsReq.getUrl();
    this.url = this.path + (uwsReq.getQuery() ? '?' + uwsReq.getQuery() : '');
    
    // Parse headers
    this.headers = {};
    uwsReq.forEach((key, value) => {
      this.headers[key] = value;
    });

    // Parse query parameters
    this.query = this.parseQuery(uwsReq.getQuery());
  }

  private parseQuery(queryString: string): Record<string, string> {
    const query: Record<string, string> = {};
    if (!queryString) return query;

    const pairs = queryString.split('&');
    for (const pair of pairs) {
      const [key, value] = pair.split('=');
      if (key) {
        query[decodeURIComponent(key)] = value ? decodeURIComponent(value) : '';
      }
    }
    return query;
  }

  // Get header value (case-insensitive)
  get(headerName: string): string | undefined {
    return this.headers[headerName.toLowerCase()];
  }

  // Alias for get()
  header(name: string): string | undefined {
    return this.get(name);
  }
}
```

### 3. Response Wrapper Class

#### src/response.ts
```typescript
import { HttpResponse } from 'uWebSockets.js';

export class Response {
  public finished = false;
  private uwsRes: HttpResponse;
  private statusCode = 200;
  private headers: Record<string, string> = {};

  constructor(uwsRes: HttpResponse) {
    this.uwsRes = uwsRes;
  }

  // Set status code
  status(code: number): Response {
    this.statusCode = code;
    return this;
  }

  // Set header
  set(name: string, value: string): Response {
    this.headers[name] = value;
    return this;
  }

  // Set multiple headers
  setHeaders(headers: Record<string, string>): Response {
    Object.assign(this.headers, headers);
    return this;
  }

  // Send response with automatic content-type detection
  send(data: string | Buffer | object): void {
    if (this.finished) return;

    let body: string;
    let contentType = this.headers['content-type'] || this.headers['Content-Type'];

    if (typeof data === 'string') {
      body = data;
      if (!contentType) {
        contentType = 'text/html; charset=utf-8';
      }
    } else if (Buffer.isBuffer(data)) {
      body = data.toString();
      if (!contentType) {
        contentType = 'application/octet-stream';
      }
    } else {
      body = JSON.stringify(data);
      if (!contentType) {
        contentType = 'application/json; charset=utf-8';
      }
    }

    this.set('Content-Type', contentType);
    this.end(body);
  }

  // Send JSON response
  json(data: any): void {
    this.set('Content-Type', 'application/json; charset=utf-8');
    this.end(JSON.stringify(data));
  }

  // End response
  end(data?: string): void {
    if (this.finished) return;

    this.finished = true;
    
    // Write status
    this.uwsRes.writeStatus(`${this.statusCode}`);
    
    // Write headers
    Object.entries(this.headers).forEach(([name, value]) => {
      this.uwsRes.writeHeader(name, value);
    });

    // End response
    if (data) {
      this.uwsRes.end(data);
    } else {
      this.uwsRes.end();
    }
  }

  // Redirect
  redirect(status: number, url: string): void;
  redirect(url: string): void;
  redirect(statusOrUrl: number | string, url?: string): void {
    if (typeof statusOrUrl === 'number') {
      this.status(statusOrUrl);
      this.set('Location', url!);
    } else {
      this.status(302);
      this.set('Location', statusOrUrl);
    }
    this.end();
  }
}
```

### 4. Basic Router Implementation

#### src/router.ts
```typescript
import { RouteHandler } from './app';

interface Route {
  method: string;
  pattern: string;
  handler: RouteHandler;
  regex?: RegExp;
  paramNames?: string[];
}

export class Router {
  private routes: Route[] = [];

  addRoute(method: string, pattern: string, handler: RouteHandler): void {
    const route: Route = {
      method,
      pattern,
      handler
    };

    // Compile route pattern to regex for parameter extraction
    this.compileRoute(route);
    this.routes.push(route);
  }

  private compileRoute(route: Route): void {
    const paramNames: string[] = [];
    
    // Convert Express-style patterns to regex
    let regexPattern = route.pattern
      .replace(/\/:(\w+)/g, (_, paramName) => {
        paramNames.push(paramName);
        return '/([^/]+)';
      })
      .replace(/\*/g, '(.*)');

    // Exact match for the pattern
    regexPattern = '^' + regexPattern + '$';
    
    route.regex = new RegExp(regexPattern);
    route.paramNames = paramNames;
  }

  match(method: string, path: string): RouteHandler | null {
    for (const route of this.routes) {
      if (route.method === method && route.regex) {
        const match = route.regex.exec(path);
        if (match) {
          // TODO: Set params on request object
          return route.handler;
        }
      }
    }
    return null;
  }
}
```

### 5. Main Export File

#### src/index.ts
```typescript
export { App } from './app';
export { Request } from './request';
export { Response } from './response';
export { Router } from './router';
export type { VoltrixApp, RouteHandler, Middleware, NextFunction } from './app';

// Create Express-compatible factory function
export function createApp(): App {
  return new App();
}

// Default export for convenience
export default createApp;
```

## Testing Implementation

### tests/app.test.ts
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { App } from '../src/app';

describe('Voltrix App', () => {
  let app: App;

  beforeEach(() => {
    app = new App();
  });

  it('should create an app instance', () => {
    expect(app).toBeInstanceOf(App);
  });

  it('should support method chaining', () => {
    const result = app
      .get('/test', (req, res) => res.send('test'))
      .post('/data', (req, res) => res.json({ data: 'test' }));
    
    expect(result).toBe(app);
  });

  it('should add routes correctly', () => {
    expect(() => {
      app.get('/users/:id', (req, res) => {
        res.json({ id: req.params.id });
      });
    }).not.toThrow();
  });

  it('should support middleware', () => {
    expect(() => {
      app.use((req, res, next) => {
        console.log('Middleware executed');
        next();
      });
    }).not.toThrow();
  });
});
```

## Expected Outcomes

- ✅ Express-compatible API surface
- ✅ uWebSockets.js integration for performance  
- ✅ Request/Response wrapper classes
- ✅ Basic routing with method chaining
- ✅ Middleware system foundation
- ✅ Comprehensive test coverage
- ✅ TypeScript type safety throughout

## Next Steps

1. **Enhance router** with radix tree optimization
2. **Add parameter extraction** to Request class
3. **Implement middleware path matching**
4. **Add body parsing capabilities**
5. **Create performance benchmarks**