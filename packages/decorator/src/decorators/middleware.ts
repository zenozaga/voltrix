import { DecoratorFactory } from '../__internal/decorator-factory.js';
import type { Middleware as VoltrixMiddleware, IRequest, IResponse, NextFunction } from '@voltrix/express';

/**
 * 🚀 Middleware Decorator
 * Can be applied to Classes or Methods.
 */
export const Middleware = (middleware: VoltrixMiddleware): ClassDecorator & MethodDecorator => {
  return DecoratorFactory.create({
    type: 'middleware',
    value: middleware
  }) as any;
};

/**
 * Exclude middleware from matching paths.
 */
// @ts-ignore
Middleware.exclude = (
  expressions: RegExp | RegExp[],
  middleware: VoltrixMiddleware
): MethodDecorator & ClassDecorator => Middleware(buildHandler('exclude', expressions, middleware));

/**
 * Only run middleware on matching paths.
 */
// @ts-ignore
Middleware.only = (
  expressions: RegExp | RegExp[],
  middleware: VoltrixMiddleware
): MethodDecorator & ClassDecorator => Middleware(buildHandler('only', expressions, middleware));

/**
 * Helper function to build middleware handlers for "only" and "exclude" modes.
 */
function buildHandler(
  mode: 'only' | 'exclude',
  expressions: RegExp | RegExp[],
  middleware: VoltrixMiddleware
): VoltrixMiddleware {
  const matchers = Array.isArray(expressions) ? expressions : [expressions];

  return (req: IRequest, res: IResponse, next: NextFunction) => {
    const matches = matchers.some(rx => rx.test(req.url));

    if ((mode === 'only' && !matches) || (mode === 'exclude' && matches)) {
      return next();
    }

    return middleware(req, res, next);
  };
}
