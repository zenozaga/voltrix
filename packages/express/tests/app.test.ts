import { describe, it, expect } from 'vitest';
import { App } from '../src/app.js';
import { Router } from '../src/router.js';
import { HTTP_STATUS } from '../src/types.js';

describe('@voltrix/express', () => {
  describe('App', () => {
    it('should create an app instance', () => {
      const app = new App();
      expect(app).toBeInstanceOf(App);
    });

    it('should support method chaining', () => {
      const app = new App();
      const result = app
        .get('/test', () => {})
        .post('/data', () => {});
      
      expect(result).toBe(app);
    });

    it('should register routes correctly', () => {
      const app = new App();
      
      expect(() => {
        app.get('/users/:id', () => {});
        app.post('/users', () => {});
      }).not.toThrow();
      
      const stats = app.getStats();
      expect(stats.routes.totalRoutes).toBeGreaterThan(0);
    });
  });

  describe('Router', () => {
    it('should create a router instance', () => {
      const router = new Router();
      expect(router).toBeInstanceOf(Router);
    });

    it('should handle static routes efficiently', () => {
      const router = new Router();
      const handler = () => {};
      
      router.addRoute('GET', '/static', handler);
      const match = router.match('GET', '/static');
      
      expect(match).toBeDefined();
      expect(match?.handler).toBe(handler);
      expect(match?.params).toEqual({});
    });

    it('should handle parameterized routes', () => {
      const router = new Router();
      const handler = () => {};
      
      router.addRoute('GET', '/users/:id', handler);
      const match = router.match('GET', '/users/123');
      
      expect(match).toBeDefined();
      expect(match?.handler).toBe(handler);
      expect(match?.params).toEqual({ id: '123' });
    });

    it('should handle multiple parameters', () => {
      const router = new Router();
      const handler = () => {};
      
      router.addRoute('GET', '/users/:userId/posts/:postId', handler);
      const match = router.match('GET', '/users/123/posts/456');
      
      expect(match).toBeDefined();
      expect(match?.params).toEqual({ userId: '123', postId: '456' });
    });

    it('should handle wildcard routes', () => {
      const router = new Router();
      const handler = () => {};
      
      router.addRoute('GET', '/files/*', handler);
      const match = router.match('GET', '/files/some/deep/path');
      
      expect(match).toBeDefined();
      expect(match?.handler).toBe(handler);
    });

    it('should return null for non-matching routes', () => {
      const router = new Router();
      router.addRoute('GET', '/users', () => {});
      
      const match = router.match('GET', '/posts');
      expect(match).toBeNull();
    });
  });

  describe('HTTP_STATUS', () => {
    it('should provide common HTTP status codes', () => {
      expect(HTTP_STATUS.OK).toBe(200);
      expect(HTTP_STATUS.NOT_FOUND).toBe(404);
      expect(HTTP_STATUS.INTERNAL_SERVER_ERROR).toBe(500);
    });
  });
});