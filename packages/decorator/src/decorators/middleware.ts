import 'reflect-metadata';
import { MiddlewareType } from '../types/middleware';
import MetadataStore from '../__internal/stores/metadata.store';
import { SYMBOLS } from '../__internal/symbols.constant';
import { Middleware as MW } from '@voltrix/express';

export const Middleware =
  (...middleware: MiddlewareType[]): ClassDecorator & MethodDecorator =>
  (Target: any, propertyKey?: any) => {
    const targetOptions = {
      target: Target,
      propertyKey,
    };

    const store: MiddlewareType[] = MetadataStore.get(SYMBOLS.MIDDLEWARE, targetOptions, []);
    store.push(...middleware);
    MetadataStore.define(SYMBOLS.MIDDLEWARE, store, targetOptions);
  };

/**
 * Exclude middleware from matching paths.
 *
 * @param expressions
 * @param middleware
 * @returns
 */
Middleware.exclude = (
  expressions: RegExp | RegExp[],
  middleware: MW
): ClassDecorator & MethodDecorator => Middleware(buildHandler('exclude', expressions, middleware));

/**
 * Only run middleware on matching paths.
 *
 * @param expresiosn
 * @param middleware
 * @returns
 */
Middleware.only = (
  expressions: RegExp | RegExp[],
  middleware: MW
): ClassDecorator & MethodDecorator => Middleware(buildHandler('only', expressions, middleware));

/**
 *
 * Helper function to build middleware handlers for "only" and "exclude" modes.
 *
 * @param mode
 * @param expresions
 * @returns
 */
const buildHandler = (
  mode: 'only' | 'exclude',
  expressions: RegExp | RegExp[],
  middleware: MW
): MW => {
  const matchers = Array.isArray(expressions) ? expressions : [expressions];

  return (req, res, next) => {
    const matches = matchers.some(rx => rx.test(req.url));

    if ((mode === 'only' && !matches) || (mode === 'exclude' && matches)) {
      return next();
    }

    return middleware(req, res, next);
  };
};
