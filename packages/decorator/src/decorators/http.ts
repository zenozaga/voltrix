/**
 * 🚀 Ultra-fast HTTP decorators
 * Zero code duplication with hyper-decor pattern
 */

import { DecoratorFactory } from '../__internal/decorator-factory';
import { MetadataRegistry } from '../__internal/metadata-registry';
import type { Middleware } from '@voltrix/core';

/* ============================================================
 * ⚙️ Types
 * ============================================================ */

export interface RouteOptions {
  middlewares?: Middleware[];
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
  options?: RouteOptions;
}

export interface WSRouteOptions extends RouteOptions {
  compression?: boolean;
  maxCompressedSize?: number;
  maxBackpressure?: number;
}

/* ============================================================
 * 🛠️ Helpers
 * ============================================================ */

/**
 * Get all routes defined on a target class
 */
export function getRoutes(target: any): RouteInfo[] {
  const ctor = typeof target === 'function' ? target : target.constructor;
  const bag = MetadataRegistry.get(ctor);
  return bag ? Array.from(bag.routes.values()) as RouteInfo[] : [];
}

/**
 * Internal route decorator creator
 */
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

/* ============================================================
 * 🚀 Standard HTTP Decorators
 * ============================================================ */

export const Connect = createRouteDecorator('CONNECT');
export const Upgrade = createRouteDecorator('UPGRADE');
export const Options = createRouteDecorator('OPTIONS');
export const Delete = createRouteDecorator('DELETE');
export const Patch = createRouteDecorator('PATCH');
export const Trace = createRouteDecorator('TRACE');
export const Head = createRouteDecorator('HEAD');
export const Post = createRouteDecorator('POST');
export const All = createRouteDecorator('ALL');
export const Put = createRouteDecorator('PUT');
export const Get = createRouteDecorator('GET');
export const WS = createRouteDecorator('WS');
