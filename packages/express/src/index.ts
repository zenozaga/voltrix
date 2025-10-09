// Export types first
export type {
  VoltrixApp,
  VoltrixRouter,
  RouteHandler,
  Middleware,
  ErrorMiddleware,
  NextFunction,
  RequestParams,
  RequestQuery,
  RequestHeaders,
  RouteMatch,
  Route,
  MiddlewareEntry,
  ObjectPool,
  PerformanceMetrics,
  HttpStatusCode,
} from './types';

export { HTTP_STATUS } from './types';

// Export classes (will be created)
export { App } from './app';
export { Request } from './request';
export { Response } from './response';
export { Router, createRouter } from './router';

/**
 * Create a new Voltrix application (Express-compatible factory)
 */
export async function createApp(): Promise<import('./app').App> {
  const { App } = await import('./app');
  return new App();
}

/**
 * Synchronous factory function
 */
export function voltrix(): import('./app').App {
  // This will be resolved at runtime after app.js is created
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { App } = require('./app.js');
  return new App();
}
