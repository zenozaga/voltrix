/**
 * 🚀 VoltrixApp - Main Application Decorators
 * Following hyper-express pattern for Voltrix Express framework
 */

import { DecoratorFactory } from '../__internal/decorator-factory.js';
import type { Middleware } from '@voltrix/express';

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
  providers?: any[];
  middleware?: Middleware[];
  port?: number;
}

/**
 * VoltrixModule decorator options
 */
export interface VoltrixModuleOptions {
  path?: string;
  controllers?: any[];
  providers?: any[];
  imports?: any[];
  middlewares?: Middleware[];
  prefix?: string;
}

/**
 * VoltrixController decorator options
 */
export interface VoltrixControllerOptions {
  path?: string;
  middlewares?: Middleware[];
}

/**
 * 🚀 VoltrixApp - Application decorator
 */
export function VoltrixApp(options: VoltrixAppOptions) {
  return DecoratorFactory.create({
    type: 'application',
    value: {
      port: 3000,
      ...options
    }
  });
}

/**
 * 🚀 Module - Module decorator
 */
export function Module(options: VoltrixModuleOptions) {
  return DecoratorFactory.create({
    type: 'module',
    value: options
  });
}

/**
 * 🚀 Controller - Controller decorator
 */
export function Controller(pathOrOptions?: string | VoltrixControllerOptions) {
  const options = typeof pathOrOptions === 'string'
    ? { path: pathOrOptions }
    : (pathOrOptions || {});

  return DecoratorFactory.create({
    type: 'controller',
    value: options
  });
}

// 📦 Aliases for backward compatibility
export const VoltrixModule = Module;
export const VoltrixController = Controller;