/**
 * 🚀 Ultra-fast HTTP decorators
 * Zero code duplication with hyper-decor pattern
 */

import { createRouteDecorator } from '../__internal/creators/route.creator.js';

// Export the creator and types
export { 
  createRouteDecorator,
  getRoutes,
  type RouteOptions,
  type RouteInfo,
  type RouterList,
  type WSRouteOptions
} from '../__internal/creators/route.creator.js';


export const Get = createRouteDecorator('GET');
export const Post = createRouteDecorator('POST');
export const Put = createRouteDecorator('PUT');
export const Delete = createRouteDecorator('DELETE');
export const Patch = createRouteDecorator('PATCH');
export const Options = createRouteDecorator('OPTIONS');
export const Head = createRouteDecorator('HEAD');
export const Trace = createRouteDecorator('TRACE');
export const All = createRouteDecorator('ALL');
export const Connect = createRouteDecorator('CONNECT');
export const WS = createRouteDecorator('WS');
export const Upgrade = createRouteDecorator('UPGRADE');
