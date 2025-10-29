/**
 * Ultra-fast decorator preparation system
 * Optimized for maximum performance with minimal overhead
 */

import { ParameterStore, getMetadata } from '../stores/index.js';
import type {
  ExecutionContext,
  RequestContext,
  ResponseContext,
  MetadataContainer} from '../types/index.js';
import {
  KEY_PARAMS,
  KEY_ROLES,
  KEY_SCOPES,
  KEY_MIDDLEWARE,
  KEY_LIFECYCLE_HOOKS
} from '../constants.js';

/**
 * High-performance execution context builder
 */
export class ExecutionContextBuilder {
  private static readonly contextCache = new WeakMap<Function, MetadataContainer>();

  /**
   * Build optimized execution context
   */
  static buildContext(
    target: Function,
    method?: string | symbol,
    args: any[] = [],
    request?: any,
    response?: any
  ): ExecutionContext {
    const metadata = this.getOrCreateMetadata(target);
    
    return {
      target,
      method,
      args,
      request: request ? this.buildRequestContext(request) : undefined,
      response: response ? this.buildResponseContext(response) : undefined,
      metadata
    };
  }

  /**
   * Get or create metadata container with caching
   */
  private static getOrCreateMetadata(target: Function): MetadataContainer {
    let metadata = this.contextCache.get(target);
    if (!metadata) {
      metadata = {
        middleware: getMetadata(KEY_MIDDLEWARE, target),
        roles: getMetadata(KEY_ROLES, target),
        scopes: getMetadata(KEY_SCOPES, target),
        parameters: getMetadata(KEY_PARAMS, target),
        lifecycle: getMetadata(KEY_LIFECYCLE_HOOKS, target)
      };
      this.contextCache.set(target, metadata);
    }
    return metadata;
  }

  /**
   * Build request context
   */
  private static buildRequestContext(request: any): RequestContext {
    return {
      request,
      response: request.response || null,
      params: request.params || {},
      query: request.query || {},
      body: request.body,
      headers: request.headers || {},
      user: request.user,
      session: request.session
    };
  }

  /**
   * Build response context
   */
  private static buildResponseContext(response: any): ResponseContext {
    return {
      statusCode: response.statusCode || 200,
      headers: response.getHeaders?.() || {},
      body: null
    };
  }

  /**
   * Clear cache for target (for memory optimization)
   */
  static clearCache(target: Function): void {
    this.contextCache.delete(target);
  }
}

/**
 * Ultra-fast security validator
 */
export class SecurityValidator {
  /**
   * Fast role validation
   */
  static validateRoles(context: ExecutionContext, userRoles: string[]): boolean {
    const roleStore = context.metadata.roles;
    if (!roleStore || roleStore.isEmpty) return true;
    
    return roleStore.checkUser(userRoles);
  }

  /**
   * Fast scope validation
   */
  static validateScopes(context: ExecutionContext, userScopes: string[]): boolean {
    const scopeStore = context.metadata.scopes;
    if (!scopeStore || scopeStore.isEmpty) return true;
    
    return scopeStore.checkUser(userScopes);
  }

  /**
   * Fast combined security validation
   */
  static validateSecurity(context: ExecutionContext, user: any): boolean {
    if (!user) return false;
    
    const userRoles = user.roles || [];
    const userScopes = user.scopes || user.permissions || [];
    
    return this.validateRoles(context, userRoles) && 
           this.validateScopes(context, userScopes);
  }
}

/**
 * Ultra-fast middleware executor
 */
export class MiddlewareExecutor {
  /**
   * Execute middlewares in order with optimal performance
   */
  static async executeMiddlewares(
    context: ExecutionContext,
    req?: any,
    res?: any
  ): Promise<boolean> {
    const middlewareStore = context.metadata.middleware;
    if (!middlewareStore || middlewareStore.isEmpty) return true;

    const middlewares = middlewareStore.getConditional(context);
    
    for (const middleware of middlewares) {
      try {
        const result = await Promise.resolve(middleware(req, res, context));
        if (result === false) return false; // Stop execution
      } catch (error) {
        console.error('Middleware execution error:', error);
        return false;
      }
    }
    
    return true;
  }

  /**
   * Execute middlewares synchronously (for performance-critical paths)
   */
  static executeMiddlewaresSync(
    context: ExecutionContext,
    req?: any,
    res?: any
  ): boolean {
    const middlewareStore = context.metadata.middleware;
    if (!middlewareStore || middlewareStore.isEmpty) return true;

    const middlewares = middlewareStore.getHandlers();
    
    for (const middleware of middlewares) {
      try {
        const result = middleware(req, res, context);
        if (result === false) return false;
      } catch (error) {
        console.error('Sync middleware execution error:', error);
        return false;
      }
    }
    
    return true;
  }
}

/**
 * Ultra-fast parameter processor
 */
export class ParameterProcessor {
  /**
   * Process method parameters with validation and transformation
   */
  static processParameters(context: ExecutionContext): any[] {
    const paramStore = context.metadata.parameters;
    if (!paramStore || paramStore.isEmpty) return context.args;

    try {
      return paramStore.processArgs(context.args);
    } catch (error) {
      console.error('Parameter processing error:', error);
      throw error;
    }
  }

  /**
   * Get parameter metadata for method
   */
  static getParameterMetadata(target: Function): ParameterStore | undefined {
    return getMetadata(KEY_PARAMS, target);
  }
}

/**
 * Ultra-fast lifecycle executor
 */
export class LifecycleExecutor {
  /**
   * Execute lifecycle hooks
   */
  static async executeLifecycle(
    context: ExecutionContext,
    hook: 'onInit' | 'onDestroy' | 'onRequest' | 'onResponse' | 'onError'
  ): Promise<void> {
    const lifecycle = context.metadata.lifecycle;
    if (!lifecycle) return;

    await lifecycle.executeHooks(hook, context);
  }

  /**
   * Execute lifecycle hooks synchronously
   */
  static executeLifecycleSync(
    context: ExecutionContext,
    hook: 'onInit' | 'onDestroy' | 'onRequest' | 'onResponse' | 'onError'
  ): void {
    const lifecycle = context.metadata.lifecycle;
    if (!lifecycle) return;

    lifecycle.executeSyncHooks(hook, context);
  }
}

/**
 * Main decorator preparation orchestrator
 */
export class DecoratorOrchestrator {
  /**
   * Prepare and execute full decorator pipeline
   */
  static async prepare(
    target: Function,
    method: string | symbol,
    args: any[],
    req?: any,
    res?: any
  ): Promise<{
    context: ExecutionContext;
    canProceed: boolean;
    processedArgs: any[];
  }> {
    // Build execution context
    const context = ExecutionContextBuilder.buildContext(target, method, args, req, res);
    
    // Execute onRequest lifecycle
    await LifecycleExecutor.executeLifecycle(context, 'onRequest');
    
    // Execute middlewares
    const middlewareSuccess = await MiddlewareExecutor.executeMiddlewares(context, req, res);
    if (!middlewareSuccess) {
      return { context, canProceed: false, processedArgs: args };
    }
    
    // Validate security
    const user = req?.user;
    if (user && !SecurityValidator.validateSecurity(context, user)) {
      return { context, canProceed: false, processedArgs: args };
    }
    
    // Process parameters
    const processedArgs = ParameterProcessor.processParameters(context);
    
    return {
      context,
      canProceed: true,
      processedArgs
    };
  }

  /**
   * Handle post-execution cleanup
   */
  static async cleanup(
    context: ExecutionContext,
    result: any,
    error?: Error
  ): Promise<void> {
    try {
      if (error) {
        await LifecycleExecutor.executeLifecycle(context, 'onError');
      } else {
        await LifecycleExecutor.executeLifecycle(context, 'onResponse');
      }
    } catch (lifecycleError) {
      console.error('Lifecycle cleanup error:', lifecycleError);
    }
  }
}