/**
 * 🚀 Ultra-fast Constants for Voltrix Decorators
 * Symbol-based keys for maximum performance and no collisions
 */

export const SYMBOLS = {
  // HTTP Methods
  HTTP_METHOD: Symbol('http:method'),
  HTTP_PATH: Symbol('http:path'),
  HTTP_OPTIONS: Symbol('http:options'),
  
  // Routes
  ROUTES: Symbol('routes'),
  
  // Controller/Module/App
  CONTROLLER: Symbol('controller'),
  MODULE: Symbol('module'), 
  APPLICATION: Symbol('application'),
  
  // Middleware
  MIDDLEWARE: Symbol('middleware'),
  
  // Security
  ROLES: Symbol('roles'),
  SCOPES: Symbol('scopes'),
  AUTH: Symbol('auth'),
  
  // Parameters
  PARAMETERS: Symbol('parameters'),
  BODY: Symbol('body'),
  PARAM: Symbol('param'),
  QUERY: Symbol('query'),
  HEADER: Symbol('header'),
  
  // Lifecycle
  LIFECYCLE: Symbol('lifecycle'),
  
  // Metadata
  METADATA: Symbol('metadata')
} as const;

// Legacy constants for compatibility
export const KEY_APP = Symbol('voltrix:type:app');
export const KEY_MODULE = Symbol('voltrix:type:module');
export const KEY_CONTROLLER = Symbol('voltrix:type:controller');
export const KEY_METHOD = Symbol('voltrix:type:method');
export const KEY_PARAMS = Symbol('voltrix:type:params');
export const KEY_ROLES = Symbol('voltrix:type:roles');
export const KEY_SCOPES = Symbol('voltrix:type:scopes');
export const KEY_PUBLIC = Symbol('voltrix:type:public');
export const KEY_PROTECTED = Symbol('voltrix:type:protected');
export const KEY_MIDDLEWARE = Symbol('voltrix:type:middleware');
export const KEY_STORE = Symbol('voltrix:metadata_store');
export const KEY_INTERCEPTORS = Symbol('voltrix:type:interceptors');
export const KEY_LIFECYCLE_HOOKS = Symbol('voltrix:type:lifecycle_hooks');

// String keys for hyper-decor compatibility  
export const KEY_TYPE_CONTROLLER = 'controller';
export const KEY_PARAMS_ROUTE = 'routes';
export const KEY_ON_INIT = Symbol('voltrix:type:on_init');
export const KEY_ON_DESTROY = Symbol('voltrix:type:on_destroy');
export const KEY_ON_REQUEST = Symbol('voltrix:type:on_request');
export const KEY_ON_RESPONSE = Symbol('voltrix:type:on_response');
export const KEY_ON_ERROR = Symbol('voltrix:type:on_error');
