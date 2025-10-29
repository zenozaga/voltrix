/**
 * 🚀 Voltrix Decorator Types - Centralized Export
 * All types exported from optimized modules
 */

// Export all types from voltrix.types.ts
export * from './voltrix.types';

export interface ScopeMetadata {
  scopes: string[];
  required: string[];
  validator?: (userScopes: string[], requiredScopes: string[]) => boolean;
}

// Module Types
export interface ModuleMetadata {
  imports?: any[];
  providers?: any[];
  controllers?: any[];
  exports?: any[];
  global?: boolean;
}

// Controller Types
export interface ControllerMetadata {
  prefix?: string;
  version?: string;
  tags?: string[];
}

// Application Types
export interface ApplicationMetadata {
  name?: string;
  version?: string;
  description?: string;
  config?: ApplicationConfig;
}

export interface ApplicationConfig {
  name?: string;
  version?: string;
  description?: string;
  port?: number;
  host?: string;
  cors?: CorsOptions;
  helmet?: boolean | Record<string, any>;
  compression?: boolean | Record<string, any>;
  rateLimit?: RateLimitOptions;
  middleware?: Function[];
  guards?: Function[];
  interceptors?: Function[];
  filters?: Function[];
}

export interface CorsOptions {
  origin?: string | string[] | boolean;
  credentials?: boolean;
  methods?: string[];
  allowedHeaders?: string[];
}

export interface RateLimitOptions {
  windowMs?: number;
  max?: number;
  message?: string;
}

// Lifecycle Types
export interface LifecycleHook {
  phase: 'before' | 'after' | 'around';
  priority: number;
  handler: Function;
}

// Validation Types
export interface ValidationSchema {
  validate: (value: any) => boolean | Promise<boolean>;
  transform?: (value: any) => any;
  message?: string;
}

// Security Types
export interface SecurityOptions {
  roles?: string[];
  scopes?: string[];
  permissions?: string[];
  custom?: (context: any) => boolean;
}

// Performance Types
export interface CacheOptions {
  ttl?: number;
  key?: string | ((args: any[]) => string);
  condition?: (args: any[]) => boolean;
}

// Error handling types
export interface ErrorFilter {
  catch: Function | Function[];
  handler: (error: any, context: any) => any;
}

// Request context types
export interface RequestContext {
  request: any;
  response: any;
  user?: any;
  roles?: string[];
  scopes?: string[];
  params?: Record<string, any>;
  query?: Record<string, any>;
  body?: any;
  headers?: Record<string, string>;
  cookies?: Record<string, string>;
}

// Decorator factory types
export type ClassDecorator = <TFunction extends Function>(target: TFunction) => TFunction | void;
export type PropertyDecorator = (target: any, propertyKey: string | symbol) => void;
export type MethodDecorator = <T>(target: any, propertyKey: string | symbol, descriptor: TypedPropertyDescriptor<T>) => TypedPropertyDescriptor<T> | void;
export type ParameterDecorator = (target: any, propertyKey: string | symbol, parameterIndex: number) => void;

// Utility types
export type DecoratorFactory<T = any> = (...args: any[]) => ClassDecorator | MethodDecorator | PropertyDecorator | ParameterDecorator;

export type Middleware = (context: RequestContext, next: () => Promise<any>) => Promise<any> | any;
export type Guard = (context: RequestContext) => boolean | Promise<boolean>;
export type Interceptor = (context: RequestContext, next: () => Promise<any>) => Promise<any>;
export type Filter = (error: any, context: RequestContext) => any;