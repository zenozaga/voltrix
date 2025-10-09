import { describe, it, expect, beforeEach } from 'vitest';
import { App } from '../src/index.js';

describe('Optimizations & Error Handling', () => {
  let app: App;

  beforeEach(() => {
    app = new App();
  });

  describe('Global Error Handler', () => {
    it('should register custom global error handler', () => {
      let errorCaptured = false;
      
      const result = app.onError((error, req, res, next) => {
        errorCaptured = true;
        res.status(500).json({ message: 'Custom error' });
      });

      expect(result).toBe(app); // Should support chaining
    });

    it('should register custom 404 handler', () => {
      const result = app.onNotFound((req, res) => {
        res.status(404).json({ message: 'Custom 404', path: req.path });
      });

      expect(result).toBe(app); // Should support chaining
    });
  });

  describe('Enhanced Statistics', () => {
    it('should provide detailed app statistics', () => {
      // Add some routes and middleware
      app.get('/users', () => {});
      app.get('/users/:id', () => {});
      app.post('/users', () => {});
      app.use((req, res, next) => next());
      app.use('/api', (req, res, next) => next());

      const stats = app.getStats();
      
      expect(stats.routes.totalRoutes).toBe(3);
      expect(stats.routes.staticRoutes).toBe(2); // /users and /users (POST)
      expect(stats.routes.paramRoutes).toBe(1);  // /users/:id
      expect(stats.middleware.globalMiddleware).toBe(2);
    });
  });

  describe('Method Chaining', () => {
    it('should support full method chaining', () => {
      const result = app
        .get('/test', (req, res) => res.json({ test: true }))
        .post('/test', (req, res) => res.json({ created: true }))
        .use((req, res, next) => next())
        .onError((error, req, res, next) => res.status(500).end())
        .onNotFound((req, res) => res.status(404).end());

      expect(result).toBe(app);
    });
  });
});