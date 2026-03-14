import { Voltrix, Router, createRouter } from '../src/index.js';
import type { Middleware } from '../src/types/handlers.js';

export interface TestServer {
  app: Voltrix;
  baseURL: string;
  port: number;
  router: Router;
}

export async function createTestServer(): Promise<TestServer> {
  // Use random port to avoid conflicts
  const port = 3000 + Math.floor(Math.random() * 1000);
  const app = new Voltrix();
  const router = new Router();
  const baseURL = `http://127.0.0.1:${port}`;

  app.useNotFound((req: any, res: any) => {
    res.status(404).json({ error: 'Not found' });
  });

  // Start server
  await new Promise<void>(resolve => {
    app.listen(port, () => {
      resolve();
    });
  });

  return { app, baseURL, port, router };
}

export async function closeTestServer(server: TestServer): Promise<void> {
  if (server.app) {
    await server.app.close();
  }
}
