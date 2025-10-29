/**
 * Ultra-fast Voltrix Decorator System
 * Optimized for maximum performance with minimal overhead
 */

import './extensions/request.extensions.js';

// Core decorators
export * from './decorators/index.js';

// Store exports for advanced usage
export { getMetadataStore } from './__internal/stores/metadata.store.js';
export { MiddlewareStore } from './__internal/stores/middleware.store.js';
export { RoleStore } from './__internal/stores/role.store.js';
export { ScopeStore } from './__internal/stores/scope.store.js';
