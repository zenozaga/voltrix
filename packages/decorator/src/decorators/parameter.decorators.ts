/**
 * 🚀 Parameter Decorators for Voltrix
 * Following hyper-express pattern for parameter injection
 */

import { DecoratorHelper } from '../__internal/helpers/decorator.helper.js';
import { SYMBOLS } from '../__internal/constants.js';

export interface ParameterInfo {
  index: number;
  type: string;
  key?: string;
  handler?: (request: any) => Promise<any> | any;
  options?: any;
}

/**
 * 🚀 Custom Request Decorator Creator
 * Like the Parser example in hyper-express
 */
export function createCustomRequestDecorator<T>(
  name: string,
  handler: (request: any) => Promise<T> | T,
  options?: any
) {
  return function (target: any, propertyKey: string | symbol | undefined, parameterIndex: number) {
    return DecoratorHelper({
      type: 'parameter',
      key: SYMBOLS.PARAMETERS,
      targetResolver: (target) => target,
      options: (saved, Target) => {
        const params = saved || [];
        params.push({
          index: parameterIndex,
          type: 'custom',
          name,
          handler,
          options,
          propertyKey
        });
        return params;
      }
    })(target, propertyKey);
  };
}

/**
 * 🚀 Body decorator - extracts request body
 */
export function Body() {
  return function (target: any, propertyKey: string | symbol | undefined, parameterIndex: number) {
    return DecoratorHelper({
      type: 'parameter',
      key: SYMBOLS.PARAMETERS,
      targetResolver: (target) => target,
      options: (saved, Target) => {
        const params = saved || [];
        params.push({
          index: parameterIndex,
          type: 'body',
          propertyKey
        });
        return params;
      }
    })(target, propertyKey);
  };
}

/**
 * 🚀 Param decorator - extracts route parameters
 */
export function Param(key?: string) {
  return function (target: any, propertyKey: string | symbol | undefined, parameterIndex: number) {
    return DecoratorHelper({
      type: 'parameter',
      key: SYMBOLS.PARAMETERS,
      targetResolver: (target) => target,
      options: (saved, Target) => {
        const params = saved || [];
        params.push({
          index: parameterIndex,
          type: 'param',
          key,
          propertyKey
        });
        return params;
      }
    })(target, propertyKey);
  };
}

/**
 * 🚀 Query decorator - extracts query parameters
 */
export function Query(key?: string) {
  return function (target: any, propertyKey: string | symbol | undefined, parameterIndex: number) {
    return DecoratorHelper({
      type: 'parameter',
      key: SYMBOLS.PARAMETERS,
      targetResolver: (target) => target,
      options: (saved, Target) => {
        const params = saved || [];
        params.push({
          index: parameterIndex,
          type: 'query',
          key,
          propertyKey
        });
        return params;
      }
    })(target, propertyKey);
  };
}

/**
 * 🚀 Res decorator - injects response object
 */
export function Res() {
  return function (target: any, propertyKey: string | symbol | undefined, parameterIndex: number) {
    return DecoratorHelper({
      type: 'parameter',
      key: SYMBOLS.PARAMETERS,
      targetResolver: (target) => target,
      options: (saved, Target) => {
        const params = saved || [];
        params.push({
          index: parameterIndex,
          type: 'res',
          propertyKey
        });
        return params;
      }
    })(target, propertyKey);
  };
}

/**
 * 🚀 Req decorator - injects request object  
 */
export function Req() {
  return function (target: any, propertyKey: string | symbol | undefined, parameterIndex: number) {
    return DecoratorHelper({
      type: 'parameter',
      key: SYMBOLS.PARAMETERS,
      targetResolver: (target) => target,
      options: (saved, Target) => {
        const params = saved || [];
        params.push({
          index: parameterIndex,
          type: 'req',
          propertyKey
        });
        return params;
      }
    })(target, propertyKey);
  };
}

/**
 * 🚀 Parser decorator factory - for Zod-like validation
 * Following the exact pattern from hyper-express example
 */
export function Parser<T>(schema: { parse: (data: any) => T }) {
  return createCustomRequestDecorator<T>(
    'Parser',
    async (request) => {
      const body = await request.json?.() || request.body;
      return schema.parse(body);
    }
  );
}