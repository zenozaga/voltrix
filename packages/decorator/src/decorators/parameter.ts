/**
 * 🚀 Parameter Decorators for Voltrix (Refactored)
 */

import { DecoratorFactory } from '../__internal/decorator-factory.js';
import { MetadataRegistry } from '../__internal/metadata-registry.js';
import type { Middleware, IRequest, Constructor } from '@voltrix/core';

export type TransformFn<T = any, R = any> = (data: T, request: IRequest) => R | Promise<R>;

/**
 * 🛠️ Universal Parameter Decorator Factory
 * Handles:
 * - @Query() -> Full query object
 * - @Query(Schema) -> Validated query object
 * - @Query("key") -> Specific key
 * - @Query("key", transform) -> Specific key with transformation/validation
 */
function createParamDecorator(type: string) {
  return (keyOrSchema?: string | Constructor | any, transform?: TransformFn) => {
    const isKey = typeof keyOrSchema === 'string';
    const isOptions = !isKey && keyOrSchema && typeof keyOrSchema === 'object' && !MetadataRegistry.get(keyOrSchema as any);

    return DecoratorFactory.create({
      type: 'parameter',
      value: {
        type,
        key: isKey ? keyOrSchema : (isOptions ? keyOrSchema.key : undefined),
        schema: isKey ? undefined : (isOptions ? keyOrSchema.schema : keyOrSchema),
        transform: transform || (isOptions ? keyOrSchema.transform : undefined),
      }
    });
  };
}

/* ============================================================
 * 🚀 Standard Decorators
 * ============================================================ */

export const Body = createParamDecorator('body');
export const Param = createParamDecorator('param');
export const Query = createParamDecorator('query');
export const Header = createParamDecorator('header');
export const Cookie = createParamDecorator('cookie');

/**
 * 🚀 Inject Request
 */
export const Req = () => DecoratorFactory.create({
  type: 'parameter',
  value: { type: 'req' }
});

/**
 * 🚀 Inject Response
 */
export const Res = () => DecoratorFactory.create({
  type: 'parameter',
  value: { type: 'res' }
});

/* ============================================================
 * 🚀 Custom Request Decorator
 * ============================================================ */
export function createCustomRequestDecorator<T>(
  name: string,
  handler: (request: IRequest) => Promise<T> | T,
  options?: any
) {
  return DecoratorFactory.create({
    type: 'parameter',
    value: {
      type: 'custom',
      name,
      transform: handler,
      options,
    }
  });
}

/**
 * 🚀 Parser decorator (Legacy support/Helper)
 */
export function Parser<T>(schema: { parse: (data: any) => T }) {
  return createCustomRequestDecorator<T>('Parser', async request => {
    const body = (await request.json?.()) || request.body;
    return schema.parse(body);
  });
}
