import 'reflect-metadata';

/**
 * Ultra-fast Voltrix Decorator System
 * Optimized for maximum performance with minimal overhead
 */

// Core decorators & Application Processor
export * from './decorators/index.js';
export * from './processors/application.processor.js';
export * from './processors/discovery.collector.js';

// Internal Utilities (Internal usage/Plugin developers)
export { MetadataRegistry, type MetadataBag } from './__internal/metadata-registry.js';
export { Metadata } from '@voltrix/core';
export { DecoratorFactory, type DecoratorConfig, type DecoratorType } from './__internal/decorator-factory.js';

// Re-exports for unified API
export {
  type AbstractConstructor,
  type Constructor,
  type Token,
  type ProviderScope,
  type BaseProvider,
  type ClassProvider,
  type FactoryProvider,
  type ValueProvider,
  type ExistingProvider,
  type Provider,
  type AppTree,
  type ModuleNode,
  type ControllerNode,
  type RouteNode,
  type DiscoveryNode,
  type IRequest,
  type IResponse,
  SecurityRegistry
} from '@voltrix/core';
export { Inject, Injectable, DIContainer } from '@voltrix/injector';
