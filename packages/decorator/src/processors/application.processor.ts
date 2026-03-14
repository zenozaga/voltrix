import { MetadataRegistry, type MetadataBag, type Constructor } from '../__internal/metadata-registry.js';
import { DIContainer } from '@voltrix/injector';
import type { IRequest, IResponse } from '@voltrix/express';

/**
 * 🌳 Discovery Tree Types
 */
export interface DiscoveryNode {
  target: Constructor;
  fullPath: string;
  meta: any;
}

export interface RouteNode extends DiscoveryNode {
  method: string;
  propertyKey: string | symbol;
}

export interface ControllerNode extends DiscoveryNode {
  routes: RouteNode[];
}

export interface ModuleNode extends DiscoveryNode {
  controllers: ControllerNode[];
}

export interface AppTree {
  name: string;
  modules: ModuleNode[];
}

/**
 * 🚀 Voltrix Application Processor V2 (The Compiler)
 */
export async function createApplication(AppClass: Constructor) {
  const container = new DIContainer();
  const bag = MetadataRegistry.get(AppClass);

  if (!bag || bag.type !== 'application') {
    throw new Error(`Class ${AppClass.name} must be decorated with @VoltrixApp`);
  }

  const { name, prefix = '', modules = [], providers = [], port = 3000 } = bag.options;

  console.log(`\n🚀 [Voltrix] Initializing "${name}"...`);

  // 1. Setup DI Container
  providers.forEach((p: any) => container.addProvider(p));
  container.register(AppClass);

  // 2. Discover Hierarchy & Register providers from modules
  for (const Mod of modules) {
    const modBag = MetadataRegistry.get(Mod);
    if (modBag?.options.providers) {
      modBag.options.providers.forEach((p: any) => container.addProvider(p));
    }
  }

  // 3. Orchestrate Async Warm-up
  // Note: We'll add a helper to DIContainer to resolve all and check onInit
  const providersInstances = await warmUpProviders(container);

  // 4. Build Discovery Tree & Generate Routes
  const tree: AppTree = { name, modules: [] };
  const app = createExpressLikeApp(); // This should be replaced with real uWS integration later

  for (const Mod of modules) {
    const modNode = await processModuleV2(Mod, prefix, container, app);
    tree.modules.push(modNode);
  }

  console.log(`✅ [Voltrix] Bootstrapped successfully on port ${port}\n`);

  return { 
    app, 
    tree,
    container,
    listen: (p?: number) => app.listen(p || port) 
  };
}

/**
 * 🚛 Sequential Async Warm-up
 * Trigger onInit in topological order (handled by DI resolution order)
 */
async function warmUpProviders(container: DIContainer) {
  // We trigger resolution of all registered providers.
  // In the future, the Injector will track instances with onInit.
  // For now, we manually scan instances in the container's store.
  const instances = container.getInstances?.() || []; 
  for (const instance of instances) {
    if (instance && typeof (instance as any).onInit === 'function') {
      await (instance as any).onInit();
    }
  }
}

/**
 * 📦 Process Module V2
 */
async function processModuleV2(Mod: Constructor, parentPath: string, container: DIContainer, app: any): Promise<ModuleNode> {
  const bag = MetadataRegistry.get(Mod);
  if (!bag) throw new Error(`Class ${Mod.name} is not a valid Module`);

  const { controllers = [], prefix = '', path = '' } = bag.options;
  const fullPath = joinPaths(parentPath, prefix, path);

  const node: ModuleNode = {
    target: Mod,
    fullPath,
    meta: bag.options,
    controllers: []
  };

  for (const Ctrl of controllers) {
    const ctrlNode = await processControllerV2(Ctrl, fullPath, container, app);
    node.controllers.push(ctrlNode);
  }

  return node;
}

/**
 * 🎯 Process Controller V2
 */
async function processControllerV2(Ctrl: Constructor, parentPath: string, container: DIContainer, app: any): Promise<ControllerNode> {
  const bag = MetadataRegistry.get(Ctrl);
  if (!bag) throw new Error(`Class ${Ctrl.name} is not a valid Controller`);

  const { path = '' } = bag.options;
  const fullPath = joinPaths(parentPath, path);
  const instance = container.resolve(Ctrl);

  const node: ControllerNode = {
    target: Ctrl,
    fullPath,
    meta: bag.options,
    routes: []
  };

  for (const [key, route] of bag.routes) {
    const routePath = joinPaths(fullPath, route.path);
    const resolver = createSpecializedResolver(bag, key);
    
    // 🔥 THE HOTPATH HANDLER
    const handler = async (req: IRequest, res: IResponse) => {
      const args = await resolver(req, res);
      const result = await (instance as any)[key](...args);
      if (result !== undefined) res.send(result);
    };

    app.addRoute(route.method, routePath, handler);

    node.routes.push({
      target: Ctrl,
      propertyKey: key,
      method: route.method,
      fullPath: routePath,
      meta: { ...route, parameters: bag.parameters.get(key) }
    });
  }

  return node;
}

/**
 * ⚡ Specialized O(1) Resolver Generator
 */
function createSpecializedResolver(bag: MetadataBag, key: string | symbol) {
  const params = bag.parameters.get(key) || [];
  
  // Pre-generate the mapper functions to avoid switch/case in hotpath
  const mappers = params.map(p => {
    let baseResolver: (req: IRequest, res: IResponse) => any;

    switch (p.type) {
      case 'body': baseResolver = (req) => req.json(); break;
      case 'query': baseResolver = (req) => p.key ? req.query[p.key] : req.query; break;
      case 'param': baseResolver = (req) => p.key ? req.params[p.key] : req.params; break;
      case 'header': baseResolver = (req) => req.header(p.key!); break;
      case 'req': baseResolver = (req) => req; break;
      case 'res': baseResolver = (_, res) => res; break;
      case 'custom': baseResolver = (req) => p.transform!(req); break;
      default: baseResolver = () => undefined;
    }

    // Apply Schema or Intent Transformation
    return async (req: IRequest, res: IResponse) => {
      let val = baseResolver(req, res);
      if (p.schema) {
        val = await MetadataRegistry.runTransform(p.schema, val, p.type, p.key);
      } else if (p.transform && p.type !== 'custom') {
        val = await p.transform(val, req);
      }
      return val;
    };
  });

  return async (req: IRequest, res: IResponse) => {
    const args = new Array(mappers.length);
    for (let i = 0; i < params.length; i++) {
      const p = params[i]!;
      args[p.index] = await mappers[i]!(req, res);
    }
    return args;
  };
}

/**
 * 🛠️ Helpers
 */
function joinPaths(...parts: string[]): string {
  return '/' + parts.filter(Boolean).map(p => p.replace(/^\/|\/$/g, '')).filter(Boolean).join('/');
}

function createExpressLikeApp() {
  const routes: any[] = [];
  return {
    addRoute: (method: string, path: string, handler: any) => routes.push({ method, path, handler }),
    listen: (port: number) => {
      console.log(`[Mock] Listening on ${port}`);
      return Promise.resolve();
    },
    _routes: routes
  };
}