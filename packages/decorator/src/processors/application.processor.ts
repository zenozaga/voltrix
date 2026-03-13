/**
 * 🚀 Voltrix Application Processor
 * Processes VoltrixApp decorators and creates the application
 */

import { getDecorData } from '../__internal/helpers/decorator.helper.js';
import { SYMBOLS, KEY_PARAMS_ROUTE } from '../__internal/symbols.constant.js';
import { RequestHelpers } from '../extensions/request.extensions.js';
import type { 
  IVoltrixApplication, 
  VoltrixAppOptions, 
  VoltrixModuleOptions 
} from '../decorators/voltrix.js';
import type { RouteInfo, RouterList } from '../__internal/creators/route.creator.js';

/**
 * 🚀 Create Voltrix Application from decorated class
 */
export async function createApplication<T extends IVoltrixApplication>(
  AppClass: new () => T
): Promise<{ app: any; appInstance: T }> {
  const appInstance = new AppClass();
  const appMetadata = getDecorData(AppClass, SYMBOLS.APPLICATION) as VoltrixAppOptions;

  if (!appMetadata) {
    throw new Error('Class must be decorated with @VoltrixApp');
  }

  console.log(`🚀 Creating Voltrix application: ${appMetadata.name}`);
  
  // Create mock express-like app for demonstration
  const app = createMockApp();

  // Apply global middleware
  if (appMetadata.middleware) {
    appMetadata.middleware.forEach(middleware => {
      app.use(middleware);
    });
  }

  // Process modules
  for (const ModuleClass of appMetadata.modules) {
    await processModule(app, ModuleClass, appMetadata.prefix);
  }

  // Call lifecycle hook
  if (appInstance.onPrepare) {
    await appInstance.onPrepare();
  }

  return { app, appInstance };
}

/**
 * Process a module and its controllers
 */
async function processModule(app: any, ModuleClass: any, globalPrefix = '') {
  const moduleMetadata = getDecorData(ModuleClass, SYMBOLS.MODULE) as VoltrixModuleOptions;
  
  if (!moduleMetadata) {
    throw new Error(`${ModuleClass.name} must be decorated with @VoltrixModule`);
  }

  const modulePath = joinPaths(globalPrefix, moduleMetadata.prefix || '', moduleMetadata.path);
  console.log(`📦 Processing module: ${ModuleClass.name} -> ${modulePath}`);

  // Apply module middleware
  if (moduleMetadata.middlewares) {
    moduleMetadata.middlewares.forEach(middleware => {
      app.use(modulePath + '/*', middleware);
    });
  }

  // Process controllers
  for (const ControllerClass of moduleMetadata.controllers || []) {
    await processController(app, ControllerClass, modulePath);
  }
}

/**
 * Process a controller and its routes
 */
async function processController(app: any, ControllerClass: any, modulePath: string) {
  const controllerInstance = new ControllerClass();
  const controllerMetadata = getDecorData(ControllerClass, SYMBOLS.CONTROLLER) as any;
  
  const controllerPath = controllerMetadata?.path || '';
  const fullControllerPath = joinPaths(modulePath, controllerPath);

  console.log(`🎯 Processing controller: ${ControllerClass.name} -> ${fullControllerPath}`);

  // Get routes from controller
  const routerList = getDecorData(ControllerClass, KEY_PARAMS_ROUTE) as RouterList;
  
  if (routerList?.routes) {
    for (const route of routerList.routes) {
      const fullPath = joinPaths(fullControllerPath, route.path);
      const handler = createEnhancedHandler(controllerInstance, route);
      
      // Register route
      app.addRoute(route.method, fullPath, handler);
      console.log(`  ${route.method.padEnd(6)} ${fullPath.padEnd(30)} -> ${route.className}.${String(route.propertyKey)}`);
    }
  }
}

/**
 * Create enhanced handler with parameter injection
 */
function createEnhancedHandler(instance: any, route: RouteInfo) {
  return async (req: any, res: any) => {
    try {
      // Get parameter metadata
      const parameters = getDecorData(instance.constructor, SYMBOLS.PARAMETERS) as any[] || [];
      const methodParams = parameters.filter((p: any) => p.propertyKey === route.propertyKey);
      
      // Resolve parameters
      const args = await resolveParameters(req, res, methodParams);
      
      // Execute method
      const result = await route.handler.apply(instance, args);
      
      // Handle response if not already sent
      if (result !== undefined && !res.headersSent) {
        if (typeof result === 'object') {
          res.json(result);
        } else {
          res.send(result);
        }
      }
    } catch (error) {
      console.error('Handler error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  };
}

/**
 * Resolve method parameters using decorators
 */
async function resolveParameters(req: any, res: any, parameters: any[]): Promise<any[]> {
  const args: any[] = [];
  
  for (const param of parameters.sort((a, b) => a.index - b.index)) {
    let value;
    
    switch (param.type) {
      case 'body':
        value = req.body;
        break;
      case 'param':
        value = param.key ? req.params[param.key] : req.params;
        break;
      case 'query':
        value = param.key ? req.query[param.key] : req.query;
        break;
      case 'req':
        value = req;
        break;
      case 'res':
        value = res;
        break;
      case 'custom':
        value = await param.handler(req);
        break;
      default:
        value = undefined;
    }
    
    args[param.index] = value;
  }
  
  return args;
}

/**
 * Helper to join paths
 */
function joinPaths(...paths: string[]): string {
  return paths
    .filter(Boolean)
    .join('/')
    .replace(/\/+/g, '/')
    .replace(/\/$/, '') || '/';
}

/**
 * Create a mock Express-like app for demonstration
 */
function createMockApp() {
  const routes: Array<{ method: string; path: string; handler: Function }> = [];
  const middlewares: Function[] = [];

  return {
    use: (pathOrMiddleware: string | Function, middleware?: Function) => {
      if (typeof pathOrMiddleware === 'function') {
        middlewares.push(pathOrMiddleware);
      } else if (middleware) {
        middlewares.push(middleware);
      }
    },
    
    addRoute: (method: string, path: string, handler: Function) => {
      routes.push({ method, path, handler });
    },

    listen: async (port: number, callback?: () => void) => {
      console.log('');
      console.log('📋 Registered Routes:');
      routes.forEach(route => {
        console.log(`  ${route.method.padEnd(6)} ${route.path}`);
      });
      console.log('');
      console.log(`🎉 Voltrix application listening on port ${port}`);
      
      if (callback) callback();
      return Promise.resolve();
    },

    getRoutes: () => routes,
    getMiddlewares: () => middlewares
  };
}