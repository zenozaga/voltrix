/**
 * Quick start utilities for common mock API patterns
 */

import { MockRouter, createMockRouter } from '../middleware/router.js';
import { mockData } from '../generators/index.js';
import type { MockRouterOptions } from '../types/index.js';

/**
 * Creates a complete REST API with standard CRUD endpoints
 */
export function createRESTAPI(options: MockRouterOptions = {}): MockRouter {
  const router = createMockRouter({
    prefix: '/api/v1',
    logging: true,
    cors: true,
    ...options,
  });

  // Users resource
  router.get('/users', {
    body: () => ({
      data: mockData.users(50),
      meta: {
        total: 150,
        page: 1,
        limit: 50,
        totalPages: 3,
      }
    })
  });

  router.get('/users/:id', {
    body: (req) => {
      const id = parseInt(req.params?.id || '1');
      const user = mockData.users(1)[0];
      return { ...user, id };
    }
  });

  router.post('/users', {
    status: 201,
    body: (req) => ({
      ...req.body,
      id: Math.floor(Math.random() * 10000),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
  });

  router.put('/users/:id', {
    body: (req) => ({
      ...req.body,
      id: parseInt(req.params?.id || '1'),
      updatedAt: new Date().toISOString(),
    })
  });

  router.delete('/users/:id', { status: 204, body: null });

  // Posts resource
  router.get('/posts', {
    body: () => ({
      data: mockData.posts(30),
      meta: { total: 100, page: 1, limit: 30, totalPages: 4 }
    })
  });

  router.get('/posts/:id', {
    body: (req) => {
      const id = parseInt(req.params?.id || '1');
      const post = mockData.posts(1)[0];
      return { ...post, id };
    }
  });

  router.post('/posts', {
    status: 201,
    body: (req) => ({
      ...req.body,
      id: Math.floor(Math.random() * 10000),
      createdAt: new Date().toISOString(),
    })
  });

  // Products resource
  router.get('/products', {
    body: () => ({
      data: mockData.products(40),
      meta: { total: 200, page: 1, limit: 40, totalPages: 5 }
    })
  });

  router.get('/products/:id', {
    body: (req) => {
      const id = parseInt(req.params?.id || '1');
      const product = mockData.products(1)[0];
      return { ...product, id };
    }
  });

  // Orders resource
  router.get('/orders', {
    body: () => ({
      data: mockData.orders(20),
      meta: { total: 80, page: 1, limit: 20, totalPages: 4 }
    })
  });

  router.get('/orders/:id', {
    body: (req) => {
      const id = parseInt(req.params?.id || '1');
      const order = mockData.orders(1)[0];
      return { ...order, id };
    }
  });

  router.post('/orders', {
    status: 201,
    body: (req) => ({
      ...req.body,
      id: Math.floor(Math.random() * 10000),
      orderNumber: `ORD-${Date.now()}`,
      status: 'pending',
      createdAt: new Date().toISOString(),
    })
  });

  return router;
}

/**
 * Creates a simple demo API for testing and examples
 */
export function createDemoAPI(options: MockRouterOptions = {}): MockRouter {
  const router = createMockRouter({
    prefix: '/demo',
    logging: true,
    cors: true,
    ...options,
  });

  // Health check
  router.get('/health', {
    body: {
      status: 'ok',
      timestamp: () => new Date().toISOString(),
      version: '1.0.0'
    }
  });

  // Echo endpoint
  router.post('/echo', {
    body: (req) => ({
      echo: req.body,
      timestamp: new Date().toISOString(),
      headers: req.headers,
    })
  });

  // Slow endpoint
  router.get('/slow', {
    body: { message: 'This response took 2 seconds' },
    delay: 2000
  });

  // Random data endpoints
  router.get('/users', { body: () => mockData.users(10) });
  router.get('/posts', { body: () => mockData.posts(5) });
  router.get('/products', { body: () => mockData.products(8) });

  // Error simulation
  router.get('/error', {
    status: 500,
    body: { error: 'Simulated server error', code: 'MOCK_ERROR' }
  });

  router.get('/not-found', {
    status: 404,
    body: { error: 'Resource not found', code: 'NOT_FOUND' }
  });

  // Random status codes
  router.get('/random', {
    body: () => {
      const statuses = [200, 201, 400, 404, 500];
      const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
      return {
        status: randomStatus,
        body: {
          message: `Random status: ${randomStatus}`,
          timestamp: new Date().toISOString()
        }
      };
    }
  });

  return router;
}

/**
 * Creates a quick API with minimal setup
 */
export function createQuickAPI(endpoints: Record<string, any>, options: MockRouterOptions = {}): MockRouter {
  const router = createMockRouter({
    logging: true,
    cors: true,
    ...options,
  });

  // Add endpoints from configuration
  Object.entries(endpoints).forEach(([path, config]) => {
    if (typeof config === 'object' && config.method) {
      router.route(config.method, path, config.response || config.body || config);
    } else {
      // Default to GET if no method specified
      router.get(path, { body: config });
    }
  });

  return router;
}