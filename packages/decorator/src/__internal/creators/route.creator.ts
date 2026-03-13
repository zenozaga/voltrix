/**
 * 🚀 Ultra-fast HTTP Route Decorator Creator
 * Optimized for minimal overhead and maximum runtime performance.
 */

import { DecoratorHelper } from '../helpers/decorator.helper.js';
import { KEY_TYPE_CONTROLLER, KEY_PARAMS_ROUTE } from '../symbols.constant.js';

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
  className: string;
  method: string;
  path: string;
  propertyKey: string | symbol;
  handler: Function;
  options?: RouteOptions;
}

export interface RouterList {
  routes: Set<RouteInfo>;
}

export function createRouteDecorator<T extends RouteOptions = RouteOptions>(method: string) {
  const upperMethod = method.toUpperCase();

  return (path: string = '/', options?: T): MethodDecorator & ClassDecorator =>
    DecoratorHelper<RouterList>({
      type: KEY_TYPE_CONTROLLER,
      key: KEY_PARAMS_ROUTE,
      targetResolver: target => target.constructor ?? target,
      options: (saved, Target, propertyKey) => {
        if (!propertyKey) return saved;

        const store = saved ?? { routes: new Set<RouteInfo>() };
        const handler = Target.prototype?.[propertyKey as string] || Target[propertyKey as string];

        if (typeof handler !== 'function') return store;

        store.routes.add({
          className: Target.name,
          method: upperMethod,
          path,
          propertyKey,
          handler,
          options,
        });

        return store;
      },
    });
}

export interface WSRouteOptions extends RouteOptions {
  compression?: boolean;
  maxCompressedSize?: number;
  maxBackpressure?: number;
}

export function getRoutes(target: any): RouteInfo[] {
  const { getDecorData } = require('../helpers/decorator.helper.js');
  const routerList = getDecorData(target, KEY_PARAMS_ROUTE) as RouterList;
  return routerList?.routes ? [...routerList.routes] : [];
}
