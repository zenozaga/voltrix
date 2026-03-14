/**
 * 🚀 Ultra-fast HTTP Route Decorator Creator
 * Optimized for minimal overhead and maximum runtime performance.
 */

import { DecoratorFactory } from '../decorator-factory.js';

export interface RouteOptions {
  middleware?: Function[];
  roles?: string[];
  scopes?: string[];
  auth?: boolean;
  rateLimit?: {
    max: number;
    window: number;
  };
  [key: string]: any;
}

export interface RouteInfo {
  method: string;
  path: string;
  propertyKey: string | symbol;
  handler: Function;
  options?: RouteOptions;
}

export function createRouteDecorator<T extends RouteOptions = RouteOptions>(method: string) {
  const upperMethod = method.toUpperCase();

  return (path: string = '/', options?: T) =>
    DecoratorFactory.create({
      type: 'route',
      value: {
        method: upperMethod,
        path,
        options,
      },
    });
}

export interface WSRouteOptions extends RouteOptions {
  compression?: boolean;
  maxCompressedSize?: number;
  maxBackpressure?: number;
}

export function getRoutes(target: any): RouteInfo[] {
  const { MetadataRegistry } = require('../metadata-registry.js');
  const ctor = typeof target === 'function' ? target : target.constructor;
  const bag = MetadataRegistry.get(ctor);
  return bag ? Array.from(bag.routes.values()) : [];
}
