/**
 * Export all stores for easy access
 */

export { getMetadataStore, getMetadata, setMetadata, hasMetadata, deleteMetadata, clearMetadata, getMetadataKeys } from './metadata.store.js';
export { MiddlewareStore, type MiddlewareDescriptor } from './middleware.store.js';
export { RoleStore, type RoleDescriptor } from './role.store.js';
export { ScopeStore, type ScopeDescriptor } from './scope.store.js';
export { ParameterStore, type ParameterDescriptor } from './parameter.store.js';