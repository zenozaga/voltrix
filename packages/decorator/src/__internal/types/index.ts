/**
 * Internal type definitions for the decorator system
 * Optimized for maximum performance
 */

import type { MiddlewareStore, RoleStore, ScopeStore, ParameterStore } from '../stores/index.js';
import type { LifecycleManager } from '../helpers/lifecycle.helper.js';

/**
 * Core decorator target types
 */
export interface DecoratorTarget {
  constructor: Function;
  prototype?: any;
}

export interface MethodTarget extends DecoratorTarget {
  propertyKey: string | symbol;
  descriptor: PropertyDescriptor;
}

export interface ParameterTarget extends DecoratorTarget {
  propertyKey: string | symbol;
  parameterIndex: number;
}

/**
 * Metadata storage interfaces
 */
export interface MetadataContainer {
  middleware?: MiddlewareStore;
  roles?: RoleStore;
  scopes?: ScopeStore;
  parameters?: ParameterStore;
  lifecycle?: LifecycleManager;
}

/**
 * Request/Response context interfaces
 */
export interface RequestContext {
  request: any;
  response: any;
  params?: Record<string, any>;
  query?: Record<string, any>;
  body?: any;
  headers?: Record<string, string>;
  user?: any;
  session?: any;
  [key: string]: any;
}

export interface ResponseContext {
  statusCode: number;
  headers: Record<string, string>;
  body: any;
  redirect?: string;
  [key: string]: any;
}

/**
 * Execution context for decorators
 */
export interface ExecutionContext {
  target: Function;
  method?: string | symbol;
  args: any[];
  request?: RequestContext;
  response?: ResponseContext;
  metadata: MetadataContainer;
  [key: string]: any;
}

/**
 * Security context interfaces
 */
export interface SecurityContext {
  user?: {
    id: any;
    roles: string[];
    scopes: string[];
    permissions: string[];
    [key: string]: any;
  };
  session?: {
    id: string;
    data: Record<string, any>;
    expires?: Date;
  };
  request: RequestContext;
}

/**
 * Module and Controller metadata
 */
export interface ModuleMetadata {
  imports?: Function[];
  providers?: Function[];
  controllers?: Function[];
  exports?: Function[];
  middleware?: Function[];
  guards?: Function[];
}

export interface ControllerMetadata {
  path?: string;
  middleware?: Function[];
  guards?: Function[];
  interceptors?: Function[];
}

export interface RouteMetadata {
  path: string;
  method: string;
  middleware?: Function[];
  guards?: Function[];
  interceptors?: Function[];
  roles?: string[];
  scopes?: string[];
}

/**
 * Application metadata
 */
export interface ApplicationMetadata {
  modules: Function[];
  providers: Map<any, any>;
  middleware: Function[];
  guards: Function[];
  interceptors: Function[];
  config: Record<string, any>;
}

/**
 * Performance optimization types
 */
export interface CacheConfig {
  enabled: boolean;
  ttl?: number;
  max?: number;
  strategy?: 'lru' | 'fifo' | 'lfu';
}

export interface PerformanceMetrics {
  executionTime: number;
  memoryUsage: number;
  cacheHits: number;
  cacheMisses: number;
}

/**
 * Error handling types
 */
export interface ErrorContext {
  error: Error;
  request: RequestContext;
  response?: ResponseContext;
  method?: string | symbol;
  target: Function;
  timestamp: Date;
}

export interface ErrorHandler {
  (error: Error, context: ErrorContext): Promise<any> | any;
}

/**
 * Utility types for type safety
 */
export type Constructor<T = {}> = new (...args: any[]) => T;
export type MethodDecorator<T = any> = (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) => PropertyDescriptor | void;
export type ClassDecorator<T = any> = <TFunction extends Constructor<T>>(target: TFunction) => TFunction | void;
export type ParameterDecorator<T = any> = (target: any, propertyKey: string | symbol | undefined, parameterIndex: number) => void;
export type PropertyDecorator<T = any> = (target: any, propertyKey: string | symbol) => void;

/**
 * Fast lookup maps for optimized access
 */
export interface FastLookupMaps {
  routes: Map<string, RouteMetadata>;
  controllers: Map<Function, ControllerMetadata>;
  modules: Map<Function, ModuleMetadata>;
  middleware: Map<string, Function>;
  guards: Map<string, Function>;
  interceptors: Map<string, Function>;
}