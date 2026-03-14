import { MetadataRegistry } from '../__internal/metadata-registry.js';
import { Constructor, AppTree, ModuleNode, ControllerNode, SecurityRegistry } from '@voltrix/core';

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
    
    const appScopes = bag.custom.get('@@global')?.get('scopes');
    const appRoles = bag.custom.get('@@global')?.get('roles');

    if (appScopes?.scopes) SecurityRegistry.registerScopes(appScopes.scopes);
    if (appRoles?.roles) SecurityRegistry.registerRoles(appRoles.roles);

    const initialContext: ProcessorContext = {
      middlewares: [
        ...(middlewares || []),
        ...(bag.middlewares.get('@@global') || [])
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

    const modScopes = bag.custom.get('@@global')?.get('scopes');
    const modRoles = bag.custom.get('@@global')?.get('roles');

    if (modScopes?.scopes) SecurityRegistry.registerScopes(modScopes.scopes);
    if (modRoles?.roles) SecurityRegistry.registerRoles(modRoles.roles);

    const modMiddlewares = [
      ...(middlewares || []),
      ...(bag.middlewares.get('@@global') || [])
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
      meta: { ...bag.options, context: modContext }
    };

    // 1. Process Controllers
    for (const Ctrl of controllers) {
      node.controllers.push(this.processController(Ctrl as Constructor, fullPath, modContext));
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

    const ctrlScopes = bag.custom.get('@@global')?.get('scopes');
    const ctrlRoles = bag.custom.get('@@global')?.get('roles');

    if (ctrlScopes?.scopes) SecurityRegistry.registerScopes(ctrlScopes.scopes);
    if (ctrlRoles?.roles) SecurityRegistry.registerRoles(ctrlRoles.roles);

    const ctrlMiddlewares = [
      ...(middlewares || []),
      ...(bag.middlewares.get('@@global') || [])
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
      meta: { ...bag.options, context: ctrlContext }
    };

    // Process Routes
    for (const [key, route] of bag.routes) {
      const routePath = (fullPath + '/' + route.path).replace(/\/+/g, '/');
      
      const routeScopes = bag.custom.get(key)?.get('scopes');
      const routeRoles = bag.custom.get(key)?.get('roles');

      if (routeScopes?.scopes) SecurityRegistry.registerScopes(routeScopes.scopes);
      if (routeRoles?.roles) SecurityRegistry.registerRoles(routeRoles.roles);

      const routeMiddlewares = bag.middlewares.get(key) || [];

      const routeContext: ProcessorContext = {
        middlewares: [...ctrlContext.middlewares, ...routeMiddlewares],
        scopes: Array.from(new Set([...ctrlContext.scopes, ...(routeScopes?.scopes || [])])),
        roles: Array.from(new Set([...ctrlContext.roles, ...(routeRoles?.roles || [])])),
        onFail: routeScopes?.onFail || routeRoles?.onFail || ctrlContext.onFail
      };

      node.routes.push({
        target: Ctrl,
        propertyKey: key,
        method: route.method,
        fullPath: routePath,
        meta: { 
          ...route, 
          parameters: bag.parameters.get(key),
          context: routeContext
        }
      });
    }

    return node;
  }
};
