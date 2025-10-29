import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Voltrix, Router, createRouter } from '../src/index';
import type { Middleware } from '../src/types/handlers';

describe('Router Integration Tests', () => {
  let app: Voltrix;
  let router: Router;
  let baseURL: string;
  let port: number;

  beforeEach(async () => {
    // Use random port to avoid conflicts
    port = 3000 + Math.floor(Math.random() * 1000);
    app = new Voltrix();
    router = new Router();
    baseURL = `http://localhost:${port}`;

    // Add 404 handler to prevent "not responding" errors
    app.get('/*', (req: any, res: any) => {
      res.status(404).json({ error: 'Not found' });
    });

    // Start server
    await new Promise<void>(resolve => {
      app.listen(port, () => {
        resolve();
      });
    });
  });

  afterEach(async () => {
    // Close server after each test
    if (app) {
      await app.close();
    }
  });

  describe('Basic Router Functionality', () => {
    it('should create router instance', () => {
      expect(router).toBeInstanceOf(Router);
      const config = router.getConfig();
      expect(config.prefix).toBe('');
    });

    it('should create router with createRouter factory', () => {
      const factoryRouter = createRouter();
      expect(factoryRouter).toBeInstanceOf(Router);
    });

    it('should register routes in router config', () => {
      router.get('/test', (req: any, res: any) => {
        res.json({ message: 'test' });
      });

      const config = router.getConfig();
      expect(config.routes).toHaveLength(1);
      expect(config.routes[0].method).toBe('GET');
      expect(config.routes[0].pattern).toBe('/test');
    });

    it('should handle real HTTP request through router', async () => {
      // Setup router
      router.get('/hello', (req: any, res: any) => {
        res.json({ message: 'Hello from router!' });
      });

      // Mount router on app
      app.use('/api', router);

      // Make real HTTP request
      const response = await fetch(`${baseURL}/api/hello`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('Hello from router!');
    });
  });

  describe('HTTP Methods', () => {
    it('should register GET route', () => {
      router.get('/test', (req: any, res: any) => {
        res.json({ method: 'GET' });
      });

      const config = router.getConfig();
      expect(config.routes).toHaveLength(1);
      expect(config.routes[0].method).toBe('GET');
      expect(config.routes[0].pattern).toBe('/test');
    });

    it('should register multiple HTTP methods', () => {
      router.get('/test', (req: any, res: any) => res.json({ method: 'GET' }));
      router.post('/test', (req: any, res: any) => res.json({ method: 'POST' }));
      router.put('/test', (req: any, res: any) => res.json({ method: 'PUT' }));

      const config = router.getConfig();
      expect(config.routes).toHaveLength(3);

      const methods = config.routes.map(r => r.method);
      expect(methods).toContain('GET');
      expect(methods).toContain('POST');
      expect(methods).toContain('PUT');
    });

    it('should handle different HTTP methods via requests', async () => {
      router.get('/method-test', (req: any, res: any) => {
        res.json({ method: 'GET' });
      });

      router.post('/method-test', (req: any, res: any) => {
        res.json({ method: 'POST' });
      });

      app.use('/api', router);

      // Test GET
      const getResponse = await fetch(`${baseURL}/api/method-test`);
      const getData = await getResponse.json();
      expect(getData.method).toBe('GET');

      // Test POST
      const postResponse = await fetch(`${baseURL}/api/method-test`, { method: 'POST' });
      const postData = await postResponse.json();
      expect(postData.method).toBe('POST');
    });
  });

  describe('Middleware Management', () => {
    it('should register global middleware', () => {
      const middleware = (req: any, res: any, next: any) => next();
      router.use(middleware);

      const config = router.getConfig();
      expect(config.middlewares).toContain(middleware);
    });

    it('should register route with middleware', () => {
      const middleware = (req: any, res: any, next: any) => next();
      const handler = (req: any, res: any) => res.json({ test: true });

      router.get('/test', middleware, handler);

      const config = router.getConfig();
      expect(config.routes[0].middlewares).toContain(middleware);
      expect(config.routes[0].handler).toBe(handler);
    });

    it('should execute middleware in HTTP requests', async () => {
      let middlewareExecuted = false;

      router.use((req: any, res: any, next: any) => {
        middlewareExecuted = true;
        req.middlewareRan = true;
        next();
      });

      router.get('/middleware-test', (req: any, res: any) => {
        res.json({
          middlewareRan: req.middlewareRan || false,
        });
      });

      app.use('/api', router);

      const response = await fetch(`${baseURL}/api/middleware-test`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(middlewareExecuted).toBe(true);
      expect(data.middlewareRan).toBe(true);
    });
  });

  describe('Child Router Management', () => {
    it('should register child router', () => {
      const childRouter = createRouter();
      childRouter.get('/test', (req: any, res: any) => {
        res.json({ child: true });
      });

      router.use('/child', childRouter);

      const config = router.getConfig();
      expect(config.childRouters.size).toBe(1);
      expect(config.childRouters.has('/child')).toBe(true);
    });

    it('should flatten child router routes', () => {
      const childRouter = createRouter();
      childRouter.get('/users', (req: any, res: any) => {
        res.json({ users: [] });
      });

      router.use('/api', childRouter);

      const flatRoutes = router.getFlattenedRoutes();
      expect(flatRoutes).toHaveLength(1);
      expect(flatRoutes[0].method).toBe('GET');
      expect(flatRoutes[0].fullPattern).toBe('/api/users');
    });

    it('should handle nested router HTTP requests', async () => {
      const userRouter = createRouter();
      userRouter.get('/profile', (req: any, res: any) => {
        res.json({ user: 'profile', nested: true });
      });

      router.use('/users', userRouter);
      app.use('/api', router);

      const response = await fetch(`${baseURL}/api/users/profile`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.user).toBe('profile');
      expect(data.nested).toBe(true);
    });
  });

  describe('Router Stats', () => {
    it('should provide router statistics', () => {
      const middleware = (req: any, res: any, next: any) => next();
      const handler = (req: any, res: any) => res.json({ test: true });

      router.use(middleware);
      router.get('/test', handler);

      const stats = router.getStats();
      expect(stats.middlewares).toBe(1);
      expect(stats.routes).toBe(1);
      expect(stats.childRouters).toBe(0);
    });
  });
});
