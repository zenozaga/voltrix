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
export { DecoratorFactory, type DecoratorConfig, type DecoratorType } from './__internal/decorator-factory.js';

// Re-exports for unified API
export * from '@voltrix/core';
export { Inject, Injectable, DIContainer } from '@voltrix/injector';
