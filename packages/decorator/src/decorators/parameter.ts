/**
 * 🚀 Parameter Decorators for Voltrix (Refactored)
 */

import { DecoratorHelper } from '../__internal/helpers/decorator.helper.js';
import { SYMBOLS } from '../__internal/symbols.constant.js';
import { IRequest } from '@voltrix/express';

export interface ParameterInfo {
  index: number;
  type: string;
  key?: string;
  name?: string;
  handler?: (request: IRequest) => Promise<any> | any;
  options?: any;
  propertyKey?: string | symbol;
}

/* ============================================================
 * 🔥 Universal Parameter Decorator Factory
 * Replaces ALL duplicated logic from Body, Param, Query, Req, Res, Parser, etc.
 * ============================================================ */
function createParamDecorator(config: {
  type: string;
  key?: string;
  name?: string;
  handler?: (request: IRequest) => any;
  options?: any;
}) {
  return function (target: any, propertyKey: string | symbol | undefined, parameterIndex: number) {
    return DecoratorHelper({
      type: 'parameter',
      key: SYMBOLS.PARAMETERS,
      targetResolver: target => target,
      options: (saved) => {
        const params = saved || [];
        params.push({
          index: parameterIndex,
          type: config.type,
          key: config.key,
          name: config.name,
          handler: config.handler,
          options: config.options,
          propertyKey,
        });
        return params;
      },
    })(target, propertyKey);
  };
}

/* ============================================================
 * 🚀 Custom Request Decorator – like HyperExpress Parser
 * ============================================================ */
export function createCustomRequestDecorator<T>(
  name: string,
  handler: (request: IRequest) => Promise<T> | T,
  options?: any
) {
  return createParamDecorator({
    type: 'custom',
    name,
    handler,
    options,
  });
}

/* ============================================================
 * 🚀 Standard Decorators
 * ============================================================ */

export const Body = () =>
  createParamDecorator({ type: 'body' });

export const Param = (key?: string) =>
  createParamDecorator({ type: 'param', key });

export const Query = (key?: string) =>
  createParamDecorator({ type: 'query', key });

export const Req = () =>
  createParamDecorator({ type: 'req' });

export const Res = () =>
  createParamDecorator({ type: 'res' });

/* ============================================================
 * 🚀 Parser decorator (Zod-like validation)
 * ============================================================ */
export function Parser<T>(schema: { parse: (data: any) => T }) {
  return createCustomRequestDecorator<T>('Parser', async request => {
    const body = (await request.json?.()) || request.body;
    return schema.parse(body);
  });
}
