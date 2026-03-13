/**
 * 🚀 VoltrixApp - Main Application Decorators
 * Following hyper-express pattern for Voltrix Express framework
 */

import { DecoratorHelper } from '../__internal/helpers/decorator.helper.js';
import { SYMBOLS } from '../__internal/symbols.constant.js';
import type { MiddlewareFunction } from '@voltrix/express';

/**
 * Interface for Voltrix Application lifecycle
 */
export interface IVoltrixApplication {
  onPrepare?(): void | Promise<void>;
  onReady?(): void | Promise<void>;
  onShutdown?(): void | Promise<void>;
}

/**
 * VoltrixApp decorator options
 */
export interface VoltrixAppOptions {
  name: string;
  version?: string;
  description?: string;
  modules: any[];
  prefix?: string;
  cors?: boolean;
  middleware?: MiddlewareFunction[];
  port?: number;
}

/**
 * VoltrixModule decorator options
 */
export interface VoltrixModuleOptions {
  path: string;
  controllers?: any[];
  middlewares?: MiddlewareFunction[];
  prefix?: string;
}

/**
 * 🚀 VoltrixApp - Application decorator
 */
export function VoltrixApp(options: VoltrixAppOptions) {
  return function <T extends { new (...args: any[]): {} }>(constructor: T) {
    return DecoratorHelper({
      type: 'application',
      key: SYMBOLS.APPLICATION,
      targetResolver: (target) => target,
      options: (saved, Target) => ({
        ...saved,
        name: options.name,
        version: options.version,
        description: options.description,
        modules: options.modules,
        prefix: options.prefix || '',
        cors: options.cors || false,
        middleware: options.middleware || [],
        port: options.port || 3000
      })
    })(constructor);
  };
}

/**
 * 🚀 VoltrixModule - Module decorator
 */
export function VoltrixModule(options: VoltrixModuleOptions) {
  return function <T extends { new (...args: any[]): {} }>(constructor: T) {
    return DecoratorHelper({
      type: 'module',
      key: SYMBOLS.MODULE,
      targetResolver: (target) => target,
      options: (saved, Target) => ({
        ...saved,
        path: options.path,
        controllers: options.controllers || [],
        middlewares: options.middlewares || [],
        prefix: options.prefix
      })
    })(constructor);
  };
}

/**
 * 🚀 VoltrixController - Controller decorator
 */
export function VoltrixController(version?: string) {
  return function <T extends { new (...args: any[]): {} }>(constructor: T) {
    return DecoratorHelper({
      type: 'controller',
      key: SYMBOLS.CONTROLLER,
      targetResolver: (target) => target,
      options: (saved, Target) => ({
        ...saved,
        version,
        path: version ? `/${version}` : ''
      })
    })(constructor);
  };
}

/**
 * 🚀 Middleware decorator
 */
export function Middleware(middleware: MiddlewareFunction) {
  return function (target: any, propertyKey?: string | symbol) {
    return DecoratorHelper({
      type: 'middleware',
      key: SYMBOLS.MIDDLEWARE,
      targetResolver: (target) => propertyKey ? target : target.constructor ?? target,
      options: (saved, Target) => {
        const middlewares = saved || [];
        middlewares.push(middleware);
        return middlewares;
      }
    })(target, propertyKey);
  };
}