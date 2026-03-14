/**
 * 🚀 Parameter Decorators for Voltrix (Refactored)
 */

import { DecoratorFactory } from '../__internal/decorator-factory.js';
import type { IRequest, IResponse } from '@voltrix/express';

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
  return (keyOrSchema?: string | any, transform?: TransformFn) => {
    const isKey = typeof keyOrSchema === 'string';
    return DecoratorFactory.create({
      type: 'parameter',
      value: {
        type,
        key: isKey ? keyOrSchema : undefined,
        schema: isKey ? undefined : keyOrSchema,
        transform: transform,
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
