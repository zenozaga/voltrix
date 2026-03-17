import 'reflect-metadata';
import { MetadataRegistry, CLASS_KEY, CUSTOM_KEYS } from '../__internal/metadata-registry.js';
import { Constructor, AppTree, ModuleNode, ControllerNode, SecurityRegistry, Metadata } from '@voltrix/core';

/**
 * 🌳 Discovery Context for Hierarchical Propagation
 */
export interface ProcessorContext {
  middlewares: any[];
  scopes: string[];
  roles: string[];
  onFail?: (...args: any[]) => any;
}

/**
 * 🌳 Discovery Collector
 * Utility to build the application discovery tree with fully resolved metadata.
 */
export const DiscoveryCollector = {
  /**
   * Build the complete discovery tree starting from an App class
   */
  async buildTree(appClass: Constructor): Promise<AppTree> {
    const bag = MetadataRegistry.getOrCreate(appClass);
    if (bag.type !== 'application') throw new Error('Target class is not a VoltrixApp');

    const { name = 'VoltrixApp', modules = [], prefix = '', middlewares = [] } = bag.options;
    
    const appScopes = bag.custom.get(CLASS_KEY)?.get(CUSTOM_KEYS.SCOPES);
    const appRoles = bag.custom.get(CLASS_KEY)?.get(CUSTOM_KEYS.ROLES);

    if (appScopes?.scopes) SecurityRegistry.registerScopes(appScopes.scopes);
    if (appRoles?.roles) SecurityRegistry.registerRoles(appRoles.roles);

    const initialContext: ProcessorContext = {
      middlewares: [
        ...(middlewares || []),
        ...(bag.middlewares.get(CLASS_KEY) || [])
      ],
      scopes: appScopes?.scopes || [],
      roles: appRoles?.roles || [],
      onFail: appScopes?.onFail || appRoles?.onFail
    };

    const tree: AppTree = { name, modules: [] };

    for (const Mod of modules) {
      tree.modules.push(this.processModule(Mod, prefix, initialContext));
    }

    return tree;
  },

  /**
   * Process a module and its children recursively
   */
  processModule(Mod: Constructor, parentPath: string, inherited: ProcessorContext): ModuleNode {
    const bag = MetadataRegistry.getOrCreate(Mod);
    const { path = '', controllers = [], modules = [], prefix = '', middlewares = [] } = bag.options;
    const fullPath = (parentPath + '/' + prefix + '/' + path).replace(/\/+/g, '/');

    const modScopes = bag.custom.get(CLASS_KEY)?.get(CUSTOM_KEYS.SCOPES);
    const modRoles = bag.custom.get(CLASS_KEY)?.get(CUSTOM_KEYS.ROLES);

    if (modScopes?.scopes) SecurityRegistry.registerScopes(modScopes.scopes);
    if (modRoles?.roles) SecurityRegistry.registerRoles(modRoles.roles);

    const modMiddlewares = [
      ...(middlewares || []),
      ...(bag.middlewares.get(CLASS_KEY) || [])
    ];

    const modContext: ProcessorContext = {
      middlewares: [...inherited.middlewares, ...modMiddlewares],
      scopes: Array.from(new Set([...inherited.scopes, ...(modScopes?.scopes || [])])),
      roles: Array.from(new Set([...inherited.roles, ...(modRoles?.roles || [])])),
      onFail: modScopes?.onFail || modRoles?.onFail || inherited.onFail
    };

    const node: ModuleNode = {
      target: Mod,
      fullPath,
      controllers: [],
      subModules: [],
      meta: { 
        ...bag.options, 
        context: modContext,
        openapi: Metadata.prefix('openapi').get(Mod)
      }
    };

    // 1. Process Controllers
    for (const Ctrl of controllers) {
      const ctrlNode = this.processController(Ctrl as Constructor, fullPath, modContext);
      // Inherit module namespace if controller doesn't have one
      if (node.meta.openapi.namespace && !ctrlNode.meta.openapi.namespace) {
        ctrlNode.meta.openapi.namespace = node.meta.openapi.namespace;
      }
      node.controllers.push(ctrlNode);
    }

    // 2. Process Sub-Modules
    for (const SubMod of modules) {
      node.subModules.push(this.processModule(SubMod, fullPath, modContext));
    }

    return node;
  },

  /**
   * Process a controller and its routes
   */
  processController(Ctrl: Constructor, parentPath: string, inherited: ProcessorContext): ControllerNode {
    const bag = MetadataRegistry.getOrCreate(Ctrl);
    const { path = '', middlewares = [] } = bag.options;
    const fullPath = (parentPath + '/' + path).replace(/\/+/g, '/');

    const ctrlScopes = bag.custom.get(CLASS_KEY)?.get(CUSTOM_KEYS.SCOPES);
    const ctrlRoles = bag.custom.get(CLASS_KEY)?.get(CUSTOM_KEYS.ROLES);

    if (ctrlScopes?.scopes) SecurityRegistry.registerScopes(ctrlScopes.scopes);
    if (ctrlRoles?.roles) SecurityRegistry.registerRoles(ctrlRoles.roles);

    const ctrlMiddlewares = [
      ...(middlewares || []),
      ...(bag.middlewares.get(CLASS_KEY) || [])
    ];

    const ctrlContext: ProcessorContext = {
      middlewares: [...inherited.middlewares, ...ctrlMiddlewares],
      scopes: Array.from(new Set([...inherited.scopes, ...(ctrlScopes?.scopes || [])])),
      roles: Array.from(new Set([...inherited.roles, ...(ctrlRoles?.roles || [])])),
      onFail: ctrlScopes?.onFail || ctrlRoles?.onFail || inherited.onFail
    };

    const node: ControllerNode = {
      target: Ctrl,
      fullPath,
      routes: [],
      meta: { 
        ...bag.options, 
        context: ctrlContext,
        openapi: Metadata.prefix('openapi').get(Ctrl)
      }
    };

    // Process Routes
    for (const [key, route] of bag.routes) {
      const routePath = (fullPath + '/' + route.path).replace(/\/+/g, '/');
      
      const routeScopes = bag.custom.get(key)?.get(CUSTOM_KEYS.SCOPES);
      const routeRoles = bag.custom.get(key)?.get(CUSTOM_KEYS.ROLES);

      if (routeScopes?.scopes) SecurityRegistry.registerScopes(routeScopes.scopes);
      if (routeRoles?.roles) SecurityRegistry.registerRoles(routeRoles.roles);

      const routeMiddlewares = bag.middlewares.get(key) || [];

      const routeContext: ProcessorContext = {
        middlewares: [...ctrlContext.middlewares, ...routeMiddlewares],
        scopes: Array.from(new Set([...ctrlContext.scopes, ...(routeScopes?.scopes || [])])),
        roles: Array.from(new Set([...ctrlContext.roles, ...(routeRoles?.roles || [])])),
        onFail: routeScopes?.onFail || routeRoles?.onFail || ctrlContext.onFail
      };

      const routeOpenApi = Metadata.prefix('openapi').get(Ctrl.prototype, key);
      
      // Automatic return type inference (stored in meta for the assembler)
      if (!routeOpenApi.responses) {
        const returnType = Reflect.getMetadata('design:returntype', Ctrl.prototype, key);
        if (returnType) {
          routeOpenApi.inferredResponse = returnType;
        }
      }
      
      // Inherit controller namespace if route doesn't have one
      if (node.meta.openapi.namespace && !routeOpenApi.namespace) {
        routeOpenApi.namespace = node.meta.openapi.namespace;
      }

      node.routes.push({
        target: Ctrl,
        propertyKey: key,
        method: route.method,
        fullPath: routePath,
        meta: { 
          ...route, 
          parameters: bag.parameters.get(key),
          context: routeContext,
          openapi: routeOpenApi
        }
      });
    }

    return node;
  }
};
