import { Middleware, NextFunction } from '@voltrix/express';

export abstract class MiddlewareClass {
  abstract handle(req: Request, res: Response, next: NextFunction): void | Promise<void>;
}

export interface MiddlewareClassConstructor {
  new (...args: any[]): MiddlewareClass;
}

/**
 * Type definition for Middleware.
 * Middleware can be a single handler or an array of handlers.
 */
export type MiddlewareType = Middleware | MiddlewareClassConstructor;
