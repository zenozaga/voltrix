/**
 * Ultra-fast decorators index
 * Optimized exports for maximum performance
 */

// HTTP decorators
export {
  Get, Post, Put, Patch, Options, Head, All,
  Route, Status, Headers, ContentType,
  Body, Param, Query, Header, Cookie, Session, Req, Res, Upload,
  Validate, Transform, Cache, Cors
} from './http.js';

// Application decorators
export {
  Application, AppName, AppVersion, AppDescription,
  EnableCors, EnableHelmet, EnableCompression, EnableRateLimit,
  Bootstrap, VoltrixApp
} from './app.js';

// Controller decorators
export {
  Controller, Version, Tags, ApiPrefix, Resource,
  UseMiddleware, UseGuards, UseInterceptors, UseFilters
} from './controller.js';

// Module decorators
export {
  Module, Global, createDynamicModule, FeatureModule, CoreModule
} from './module.js';

// Middleware decorators
export {
  Middleware as MiddlewareDecorator, Middlewares, ConditionalMiddleware,
  Before, After, Auth, RateLimit
} from './middleware.js';

// Security decorators
export {
  Role, RequireRoles, Admin, User, Moderator, Owner,
  AnyRole, AllRoles, CustomRole, RoleHierarchy, Public, Protected
} from './role.js';

export {
  Scope, RequireScopes, Read, Write, AdminScope, UserScope,
  ReadResource, WriteResource, DeleteResource,
  AnyScope, AllScopes, CustomScope, ScopeInheritance,
  FullAccess, NoAccess, TemporaryScope, ContextScope
} from './scope.js';

// File decorators - to be implemented
// export * from './file.js';

// Type exports with aliases to avoid conflicts
export type {
  HttpMethod, RouteMetadata, ParameterType, ParameterMetadata,
  MiddlewareMetadata, RoleMetadata, ScopeMetadata,
  ControllerMetadata, ApplicationMetadata,
  CorsOptions, RateLimitOptions,
  LifecycleHook, ValidationSchema, SecurityOptions, CacheOptions,
  ErrorFilter, RequestContext,
  DecoratorFactory, Middleware, Guard, Interceptor, Filter
} from './types/index.js';

export type { 
  ModuleMetadata as IModuleMetadata,
  ApplicationConfig as IApplicationConfig 
} from './types/index.js';
