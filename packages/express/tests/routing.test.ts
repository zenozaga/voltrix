import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { voltrix, Voltrix } from '../src/voltrix';
import { createRouter, Router } from '../src/router';

let app: Voltrix;
let baseURL: string;

describe('Voltrix Router + Nested Routers', () => {
  beforeAll(async () => {
    app = voltrix();
    const mainRouter = createRouter();

    // Middleware global del router principal
    mainRouter.use((req, res, next) => {
      res.header('X-Main-Router', 'true');
      next();
    });

    mainRouter.any('/ping', (req, res) => {
      res.json({ ok: true });
    });

    // Router hijo /api/users
    const userRouter = new Router();

    // Middleware del subrouter
    userRouter.use((req, res, next) => {
      res.header('X-User-Router', 'true');
      next();
    });

    // Endpoint dentro del router hijo
    userRouter.get('/:id', (req, res) => {
      res.json({
        userId: req.getParam('id'),
        from: 'userRouter',
      });
    });

    // Router hijo montado dentro del principal
    mainRouter.use('/users', userRouter);

    // Monta el router principal en la app
    app.use('/api', mainRouter);

    await new Promise<void>(resolve => {
      app.listen(3000, () => {
        baseURL = `http://localhost:3000`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('should respond from root router', async () => {
    const response = await fetch(`${baseURL}/api/ping`);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(response.headers.get('x-main-router')).toBe('true');
  });

  it('should respond from nested user router', async () => {
    const response = await fetch(`${baseURL}/api/users/42`);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.userId).toBe('42');
    expect(data.from).toBe('userRouter');
    expect(response.headers.get('x-main-router')).toBe('true');
    expect(response.headers.get('x-user-router')).toBe('true');
  });

    it('should return 404 for unknown routes', async () => {
      const response = await fetch(`${baseURL}/api/unknown`);
      expect(response.status).toBe(404);
    });
});
