import { MetadataRegistry, type MetadataBag, type Constructor } from '../__internal/metadata-registry.js';
import { DIContainer } from '@voltrix/injector';
import { Voltrix, type IRequest, type IResponse } from '@voltrix/express';

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
  subModules: ModuleNode[];
}

export interface AppTree {
  name: string;
  modules: ModuleNode[];
}

/**
 * 🚀 Voltrix Application Processor V2 (The Compiler)
 */
export async function createApplication(appClass: Constructor) {
  const container = new DIContainer();
  const bag = MetadataRegistry.getOrCreate(appClass);

  if (bag.type !== 'application') throw new Error('Target class is not a VoltrixApp');

  const {
    name = 'VoltrixApp',
    prefix = '',
    modules = [],
    providers = [],
    port = 3000
  } = bag.options;

  console.log(`\n🚀 [Voltrix] Bootstrapping application "${name}"...`);

  // 1. Setup DI Container
  providers.forEach((p: any) => container.addProvider(p));
  container.addProvider(appClass);


  // 2. Register Modules, their Providers and Controllers (Recursive)
  const registered = new Set<Constructor>();
  const registerModule = (Mod: Constructor) => {
    if (registered.has(Mod)) return;
    registered.add(Mod);

    container.addProvider(Mod);
    const modBag = MetadataRegistry.get(Mod);
    if (!modBag) return;

    if (modBag.options.providers) {
      modBag.options.providers.forEach(p => container.addProvider(p as any));
    }
    if (modBag.options.controllers) {
      modBag.options.controllers.forEach(c => container.addProvider(c));
    }
    if (modBag.options.modules) {
      modBag.options.modules.forEach(sub => registerModule(sub));
    }
  };

  modules.forEach(Mod => registerModule(Mod));

  // 3. Orchestrate Async Warm-up
  await warmUpProviders(container);

  // 4. Build Discovery Tree & Generate Routes with Hierarchical Context
  const tree: AppTree = { name: name!, modules: [] };
  const app = new Voltrix();

  const appScopes = bag.custom.get('@@global')?.get('scopes');
  const appRoles = bag.custom.get('@@global')?.get('roles');

  const initialContext: ProcessorContext = {
    middlewares: bag.options.middlewares || [],
    scopes: appScopes?.scopes || [],
    roles: appRoles?.roles || [],
    onFail: appScopes?.onFail || appRoles?.onFail
  };

  for (const Mod of modules) {
    const modNode = await processModuleV2(Mod, prefix, container, app, initialContext);
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
  // To warm up, we must attempt to resolve all registered tokens
  // We use a safe resolution strategy
  // @ts-ignore
  const tokens = Array.from(container.providers.keys());

  for (const token of tokens) {
    try {
      const instance = container.resolve(token as any);
      if (instance && typeof (instance as any).onInit === 'function') {
        await (instance as any).onInit();
      }
    } catch (e) {
      // Some providers might fail resolution if they are abstract or have missing deps
      // We skip them during warm-up as They'll be resolved later if needed
    }
  }
}

/**
 * 🌳 Discovery Context for Hierarchical Propagation
 */
interface ProcessorContext {
  middlewares: any[];
  scopes: string[];
  roles: string[];
  onFail?: (req: IRequest, res: IResponse) => any;
}

/**
 * 📦 Process Module V2
 */
async function processModuleV2(
  Mod: Constructor,
  parentPath: string,
  container: DIContainer,
  app: any,
  inherited: ProcessorContext
): Promise<ModuleNode> {
  const bag = MetadataRegistry.get(Mod);
  if (!bag) throw new Error(`Class ${Mod.name} is not a valid Module`);

  const { controllers = [], modules = [], prefix = '', path = '', middlewares = [] } = bag.options;
  const fullPath = joinPaths(parentPath, prefix, path);

  const modScopes = bag.custom.get('@@global')?.get('scopes');
  const modRoles = bag.custom.get('@@global')?.get('roles');

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
    meta: bag.options,
    controllers: [],
    subModules: []
  };

  // Process Sub-modules
  for (const Sub of modules) {
    const subNode = await processModuleV2(Sub, fullPath, container, app, modContext);
    node.subModules.push(subNode);
  }

  // Process Controllers
  for (const Ctrl of controllers) {
    const ctrlNode = await processControllerV2(Ctrl, fullPath, container, app, modContext);
    node.controllers.push(ctrlNode);
  }

  return node;
}

/**
 * 🎯 Process Controller V2
 */
async function processControllerV2(
  Ctrl: Constructor,
  parentPath: string,
  container: DIContainer,
  app: any,
  inherited: ProcessorContext
): Promise<ControllerNode> {
  const bag = MetadataRegistry.get(Ctrl);
  if (!bag) throw new Error(`Class ${Ctrl.name} is not a valid Controller`);

  const { path = '', middlewares = [] } = bag.options;
  const fullPath = joinPaths(parentPath, path);
  const instance = container.resolve(Ctrl);

  const ctrlScopes = bag.custom.get('@@global')?.get('scopes');
  const ctrlRoles = bag.custom.get('@@global')?.get('roles');

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

  if (!instance) {
    throw new Error(`Failed to resolve controller ${Ctrl.name}. Check if it is properly registered.`);
  }

  // Basic check for common injection failure (null services)
  // We can't know for sure if a specific property is a service without more metadata,
  // but we can check if any constructor arguments were resolved as null if we had that info.
  // For now, we trust the Injector, but we'll add a sanity check.
  Object.keys(instance).forEach(key => {
    if ((instance as any)[key] === null || (instance as any)[key] === undefined) {
      // Optional: Log warning about potential missing dependency
      // console.warn(`[Voltrix] Warning: Dependency "${key}" in ${Ctrl.name} is ${typeof (instance as any)[key]}`);
    }
  });

  const node: ControllerNode = {
    target: Ctrl,
    fullPath,
    meta: bag.options,
    routes: []
  };

  for (const [key, route] of bag.routes) {
    const routePath = joinPaths(fullPath, route.path);
    const resolver = createSpecializedResolver(bag, key);

    // 🧬 Gather Middlewares (Method level)
    const methodMiddlewares = bag.middlewares.get(key) || [];
    const finalMiddlewares = [...ctrlContext.middlewares, ...methodMiddlewares];

    // 🔬 Gather Scopes & Roles (Method level)
    const routeScopeOptions = bag.custom.get(key)?.get('scopes');
    const routeRoleOptions = bag.custom.get(key)?.get('roles');

    const finalScopes = Array.from(new Set([...ctrlContext.scopes, ...(routeScopeOptions?.scopes || [])]));
    const finalRoles = Array.from(new Set([...ctrlContext.roles, ...(routeRoleOptions?.roles || [])]));
    const finalOnFail = routeScopeOptions?.onFail || routeRoleOptions?.onFail || ctrlContext.onFail;

    // 🔥 THE HOTPATH HANDLER
    const handler = async (req: IRequest, res: IResponse) => {
      try {
        // 1. Run Middlewares (App -> Module -> Controller -> Method)
        for (const mid of finalMiddlewares) {
          await new Promise<void>((resolve, reject) => {
            mid(req, res, (err?: any) => err ? reject(err) : resolve());
          });
          if (res.headersSent) return; // Middleware already sent response
        }

        // 2. Run Scopes (if any) - Now they have access to req.user from middlewares
        if (finalScopes.length > 0) {
          const userScopes = (req as any).user?.scopes || [];
          const hasAccess = finalScopes.every((s: string) => userScopes.includes(s));

          if (!hasAccess) {
            if (finalOnFail) return finalOnFail(req, res);
            return res.status(403).json({ error: 'Forbidden', required: finalScopes });
          }
        }

        // 3. Run Roles (if any)
        if (finalRoles.length > 0) {
          const userRoles = (req as any).user?.roles || [];
          const hasRole = finalRoles.some((r: string) => userRoles.includes(r));

          if (!hasRole) {
            if (finalOnFail) return finalOnFail(req, res);
            return res.status(403).json({ error: 'Forbidden', required: finalRoles });
          }
        }

        // 4. Resolve Params & Execute
        // console.log(`[DEBUG] Resolving params for ${routePath}`);
        const args = await resolver(req, res);
        const result = await (instance as any)[key](...args);
        if (result !== undefined) {
          if (typeof result === 'object' && result !== null) res.json(result);
          else res.send(String(result));
        }
      } catch (e: any) {
        console.error(`ERROR in route [${route.method}] ${routePath}:`, e.stack || e.message);
        if (!res.headersSent && !res.isAborted) {
          res.status(500).json({ error: 'Internal Server Error' });
        }
      }
    };

    app.any(routePath, handler as any);

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