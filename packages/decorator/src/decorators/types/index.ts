/**
 * 🚀 Voltrix Decorator Types - Centralized Export
 */

export interface ScopeMetadata {
  scopes: string[];
  required: string[];
  validator?: (userScopes: string[], requiredScopes: string[]) => boolean;
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

export type MiddlewareFn = (context: RequestContext, next: () => Promise<any>) => Promise<any> | any;
export type GuardFn = (context: RequestContext) => boolean | Promise<boolean>;
export type InterceptorFn = (context: RequestContext, next: () => Promise<any>) => Promise<any>;
export type FilterFn = (error: any, context: RequestContext) => any;