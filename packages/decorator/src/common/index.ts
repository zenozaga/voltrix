/**
 * Common utilities and services for Voltrix decorators
 */

// Export DI container and decorators
export {
  DIContainer,
  Injectable,
  Inject,
  Singleton,
  Transient,
  Scoped,
  container,
  INJECTABLE_METADATA,
  INJECT_METADATA
} from './di-container.js';