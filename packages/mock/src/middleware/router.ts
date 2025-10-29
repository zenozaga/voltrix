/**
 * Mock Router for Voltrix - Integrates with @voltrix/express
 */

// @ts-ignore - Will be available at runtime through peer dependency
import { Router } from '@voltrix/express';
// @ts-ignore - Will be available at runtime through peer dependency  
import type { Request, Response } from '@voltrix/express';
import type {
  MockRoute,
  MockResponse,
  MockResponseBody,
  MockCollection,
  MockRouterOptions,
  MockRouter as IMockRouter,
} from '../types/index.js';
import { mockData } from '../generators/index.js';

export class MockRouter {
  private router: Router;
  private routes: MockRoute[] = [];
  private opts: Required<MockRouterOptions>;
  private responseIndexes: Map<string, number> = new Map();

  constructor(options: MockRouterOptions = {}) {
    this.router = new Router();
    this.opts = {
      delay: options.delay || 0,
      prefix: options.prefix || '',
      cors: options.cors !== false,
      logging: options.logging !== false,
      fallthrough: options.fallthrough !== false,
    };

    this.setupMiddleware();
  }

  private setupMiddleware(): void {
    // Add CORS middleware if enabled
    if (this.opts.cors) {
      this.router.use((req: Request, res: Response, next: () => void) => {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
        
        if (req.method === 'OPTIONS') {
          return res.status(200).end();
        }
        
        next();
      });
    }

    // Add logging middleware if enabled
    if (this.opts.logging) {
      this.router.use((req: Request, res: Response, next: () => void) => {
        console.log(`🎭 [Mock] ${req.method} ${req.path}`);
        next();
      });
    }
  }

  // HTTP method shortcuts
  get(path: string, response: MockResponse | MockResponseBody): MockRouter {
    return this.route('GET', path, response);
  }

  post(path: string, response: MockResponse | MockResponseBody): MockRouter {
    return this.route('POST', path, response);
  }

  put(path: string, response: MockResponse | MockResponseBody): MockRouter {
    return this.route('PUT', path, response);
  }

  delete(path: string, response: MockResponse | MockResponseBody): MockRouter {
    return this.route('DELETE', path, response);
  }

  patch(path: string, response: MockResponse | MockResponseBody): MockRouter {
    return this.route('PATCH', path, response);
  }

  options(path: string, response: MockResponse | MockResponseBody): MockRouter {
    return this.route('OPTIONS', path, response);
  }

  // Generic route method
  route(method: string, path: string, response: MockResponse | MockResponseBody): MockRouter {
    const fullPath = this.opts.prefix + path;
    
    // Normalize response
    const mockResponse = this.normalizeResponse(response);
    
    // Create mock route
    const mockRoute: MockRoute = {
      method: method.toUpperCase(),
      path: fullPath,
      response: mockResponse,
      description: `Mock ${method.toUpperCase()} ${fullPath}`,
    };
    
    this.routes.push(mockRoute);

    // Register with Voltrix router
    const handler = this.createHandler(mockRoute);
    
    switch (method.toLowerCase()) {
      case 'get':
        this.router.get(fullPath, handler);
        break;
      case 'post':
        this.router.post(fullPath, handler);
        break;
      case 'put':
        this.router.put(fullPath, handler);
        break;
      case 'delete':
        this.router.delete(fullPath, handler);
        break;
      case 'patch':
        this.router.patch(fullPath, handler);
        break;
      case 'options':
        this.router.options(fullPath, handler);
        break;
      default:
        throw new Error(`Unsupported HTTP method: ${method}`);
    }

    if (this.opts.logging) {
      console.log(`🎭 Mock route registered: ${method.toUpperCase()} ${fullPath}`);
    }

    return this;
  }

  // Add a collection of routes
  collection(collection: MockCollection): MockRouter {
    const baseUrl = collection.baseUrl || '';
    
    collection.routes.forEach(route => {
      this.route(route.method, baseUrl + route.path, route.response);
    });

    if (this.opts.logging) {
      console.log(`🎭 Mock collection "${collection.name}" added with ${collection.routes.length} routes`);
    }

    return this;
  }

  // Configuration methods
  delay(ms: number): MockRouter {
    this.opts.delay = ms;
    return this;
  }

  cors(enable = true): MockRouter {
    this.opts.cors = enable;
    return this;
  }

  logging(enable = true): MockRouter {
    this.opts.logging = enable;
    return this;
  }

  // Utility methods
  getRoutes(): MockRoute[] {
    return [...this.routes];
  }

  clear(): MockRouter {
    this.routes = [];
    this.responseIndexes.clear();
    // Note: Cannot clear already registered Voltrix routes
    if (this.opts.logging) {
      console.log('🎭 Mock routes cleared');
    }
    return this;
  }

  // Get the underlying Voltrix router
  getRouter(): Router {
    return this.router;
  }

  // Private helper methods
  private normalizeResponse(response: MockResponse | MockResponseBody): MockResponse {
    if (typeof response === 'object' && response !== null && 'status' in response) {
      return response as MockResponse;
    }
    
    return {
      status: 200,
      body: response,
    };
  }

  private createHandler(mockRoute: MockRoute) {
    return async (req: Request, res: Response) => {
      try {
        // Get response (handle array rotation)
        const mockResponse = this.getResponse(mockRoute);
        
        // Apply delay
        const delay = mockResponse.delay || this.opts.delay;
        if (delay > 0) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        // Set status
        res.status(mockResponse.status || 200);

        // Set headers
        if (mockResponse.headers) {
          Object.entries(mockResponse.headers).forEach(([key, value]) => {
            res.header(key, value);
          });
        }

        // Resolve and send body
        const body = this.resolveBody(mockResponse.body || null, req);
        this.sendResponse(res, body);

      } catch (error) {
        console.error('🎭 Mock route error:', error);
        if (!this.opts.fallthrough) {
          res.status(500).json({ 
            error: 'Mock route error',
            message: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
    };
  }

  private getResponse(route: MockRoute): MockResponse {
    if (!Array.isArray(route.response)) {
      return route.response;
    }

    // Handle array rotation
    const routeKey = `${route.method}:${route.path}`;
    const currentIndex = this.responseIndexes.get(routeKey) || 0;
    const response = route.response[currentIndex];
    
    // Update index for next request
    this.responseIndexes.set(routeKey, (currentIndex + 1) % route.response.length);
    
    return response || { status: 200, body: null };
  }

  private resolveBody(body: MockResponseBody, req: Request): any {
    if (typeof body === 'function') {
      return body({
        method: req.method,
        path: req.path,
        query: req.query,
        params: req.params,
        headers: req.headers(),
        body: req.body,
      });
    }
    return body;
  }

  private sendResponse(res: Response, body: any): void {
    if (body === null || body === undefined) {
      res.end();
    } else if (typeof body === 'string') {
      res.send(body);
    } else if (Buffer.isBuffer(body)) {
      res.end(body);
    } else {
      res.json(body);
    }
  }
}

// Factory functions for convenience
export function createMockRouter(options?: MockRouterOptions): MockRouter {
  return new MockRouter(options);
}

// Pre-built API collections
export const MockCollections = {
  // REST API with standard endpoints
  restAPI(options: MockRouterOptions = {}): MockRouter {
    const router = new MockRouter({ 
      prefix: '/api',
      logging: true,
      ...options 
    });

    // Users endpoints
    router.get('/users', {
      body: () => ({
        data: mockData.users(25),
        pagination: {
          page: 1,
          limit: 25,
          total: 100,
          totalPages: 4,
        }
      })
    });

    router.get('/users/:id', {
      body: (req) => {
        const users = mockData.users(1);
        return { ...users[0], id: parseInt(req.params?.id || '1') };
      }
    });

    router.post('/users', {
      status: 201,
      body: (req) => ({
        ...req.body,
        id: Math.floor(Math.random() * 1000) + 100,
        createdAt: new Date().toISOString(),
      })
    });

    // Posts endpoints
    router.get('/posts', {
      body: () => ({
        data: mockData.posts(20),
        pagination: { page: 1, limit: 20, total: 50 }
      })
    });

    router.get('/posts/:id', {
      body: (req) => {
        const posts = mockData.posts(1);
        return { ...posts[0], id: parseInt(req.params?.id || '1') };
      }
    });

    // Products endpoints
    router.get('/products', {
      body: () => ({
        data: mockData.products(30),
        pagination: { page: 1, limit: 30, total: 100 }
      })
    });

    router.get('/products/:id', {
      body: (req) => {
        const products = mockData.products(1);
        return { ...products[0], id: parseInt(req.params?.id || '1') };
      }
    });

    return router;
  },

  // Simple demo endpoints
  demo(options: MockRouterOptions = {}): MockRouter {
    const router = new MockRouter({
      prefix: '/demo',
      logging: true,
      ...options
    });

    router.get('/hello', {
      body: { message: 'Hello from Voltrix Mock!', timestamp: new Date().toISOString() }
    });

    router.get('/users', {
      body: () => mockData.users(10)
    });

    router.get('/slow', {
      body: { message: 'This response was delayed' },
      delay: 2000
    });

    router.post('/echo', {
      body: (req) => ({
        received: req.body,
        timestamp: new Date().toISOString()
      })
    });

    return router;
  }
};