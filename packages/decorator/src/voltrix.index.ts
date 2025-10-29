/**
 * 🚀 Voltrix Decorators - Main Export
 * Complete decorator system following hyper-express patterns
 */

// Core HTTP decorators (zero duplication)
export * from './decorators/http.js';

// Voltrix application decorators  
export * from './decorators/voltrix.decorators.js';

// Parameter decorators
export * from './decorators/parameter.decorators.js';

// Request extensions
export * from './extensions/request.extensions.js';

// Application processor
export * from './processors/application.processor.js';

// Helpers and creators
export { 
  createRouteDecorator,
  type RouteOptions,
  type RouteInfo,
  type RouterList 
} from './__internal/creators/route.creator.js';

export {
  getDecorData
} from './__internal/helpers/decorator.helper.js';

export {
  createCustomRequestDecorator,
  type ParameterInfo
} from './decorators/parameter.decorators.js';

// Legacy exports for compatibility
export * from './decorators/role.js';
export * from './decorators/scope.js';
export * from './decorators/middleware.js';