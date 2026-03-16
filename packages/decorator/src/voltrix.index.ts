/**
 * 🚀 Voltrix Decorators - Main Export
 * Complete decorator system following hyper-express patterns
 */

// Core HTTP decorators (zero duplication)
export * from './decorators/http.js';

// Voltrix application decorators  
export * from './decorators/voltrix.js';

// Parameter decorators
export * from './decorators/parameter.js';

// Request extensions
export * from './extensions/request.extensions.js';

// Application processor
export * from './processors/application.processor.js';
export { DiscoveryCollector } from './processors/discovery.collector.js';

// OpenAPI decorators
export * from './decorators/openapi.js';

// Helpers and creators
export {
  createCustomRequestDecorator,
} from './decorators/parameter.js';

// Legacy exports for compatibility
export * from './decorators/role.js';
export * from './decorators/scope.js';
export * from './decorators/middleware.js';