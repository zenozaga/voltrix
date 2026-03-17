import { MetadataRegistry, type MetadataBag } from '../__internal/metadata-registry';
import { DIContainer } from '@voltrix/injector';
import { Voltrix } from '@voltrix/express';
import {
  Constructor,
  AppTree,
  ModuleNode,
  ControllerNode,
  IRequest,
  IResponse
} from '@voltrix/core';
import { DiscoveryCollector, type ProcessorContext } from './discovery.collector';


export interface VoltrixApplication {
  app: Voltrix;
  tree: AppTree;
  container: DIContainer;
  listen: (p?: number) => Promise<void>;
}

/**
 * 🚀 Voltrix Application Processor V2 (The Compiler)
 */
export async function createApplication(appClass: Constructor): Promise<VoltrixApplication> {
  const container = new DIContainer();
  const bag = MetadataRegistry.getOrCreate(appClass);

  if (bag.type !== 'application') throw new Error('Target class is not a VoltrixApp');

  const {
    name = 'VoltrixApp',
    port = 3000,
    providers = []
  } = bag.options;

  console.log(`\n🚀 [Voltrix] Bootstrapping application "${name}"...`);

  // 1. Setup DI Container
  if (providers) {
    providers.forEach((p: any) => container.addProvider(p));
  }
  container.addProvider(appClass);

  // 2. Build Discovery Tree (The Helper)
  const tree = await DiscoveryCollector.buildTree(appClass);

  // 3. Register Modules recursively into DI
  const registered = new Set<Constructor>();
  const registerModuleDI = (node: ModuleNode) => {
    if (registered.has(node.target)) return;
    registered.add(node.target);
    container.addProvider(node.target);

    const modBag = MetadataRegistry.get(node.target);
    if (!modBag) return;

    if (modBag.options.providers) {
      modBag.options.providers.forEach((p: any) => container.addProvider(p));
    }
    if (modBag.options.controllers) {
      modBag.options.controllers.forEach((c: any) => container.addProvider(c));
    }

    node.subModules.forEach((sub: ModuleNode) => registerModuleDI(sub));
  };
  tree.modules.forEach((m: ModuleNode) => registerModuleDI(m));

  // 4. Orchestrate Async Warm-up
  await warmUpProviders(container);

  // 5. Register Routes based on the Tree
  const app = new Voltrix();
  for (const mod of tree.modules) {
    await registerModuleRoutes(mod, container, app);
  }

  console.log(`✅ [Voltrix] Bootstrapped successfully on port ${port}\n`);

  return {
    app,
    tree,
    container,
    listen: async (p?: number) => {
      await app.listen(p || port);
    }
  };
}

/**
 * 🚛 Sequential Async Warm-up
 */
async function warmUpProviders(container: DIContainer) {
  // @ts-ignore - Accessing internal providers for warm-up
  const tokens = Array.from(container.providers.keys());

  for (const token of tokens) {
    try {
      const instance = container.resolve(token as any);
      if (instance && typeof (instance as any).onInit === 'function') {
        await (instance as any).onInit();
      }
    } catch (e) {
      // Skip if resolution fails (abstracts, etc.)
    }
  }
}

/**
 * 🛫 Register Module Routes
 */
async function registerModuleRoutes(node: ModuleNode, container: DIContainer, app: Voltrix) {
  // 1. Process Controllers
  for (const ctrlNode of node.controllers) {
    await registerControllerRoutes(ctrlNode, container, app);
  }

  // 2. Process Sub-Modules
  for (const sub of node.subModules) {
    await registerModuleRoutes(sub, container, app);
  }
}

/**
 * 🎯 Register Controller Routes
 */
async function registerControllerRoutes(node: ControllerNode, container: DIContainer, app: Voltrix) {
  const instance = container.resolve(node.target);
  if (!instance) throw new Error(`Failed to resolve controller ${node.target.name}`);

  for (const route of node.routes) {
    const bag = MetadataRegistry.get(node.target)!;
    const resolver = createSpecializedResolver(bag, route.propertyKey, app);
    const context: ProcessorContext = route.meta.context;

    // 🔥 THE HOTPATH HANDLER
    const handler = async (req: IRequest, res: IResponse) => {
      try {
        // 1. Run Middlewares
        for (const mid of context.middlewares) {
          await new Promise<void>((resolve, reject) => {
            mid(req, res, (err?: any) => err ? reject(err) : resolve());
          });
          if (res.headersSent) return;
        }

        // 2. Run Scopes (AND)
        if (context.scopes.length > 0) {
          const user = req.user || {};
          const userScopes = user.scopes || [];
          const isGod = userScopes.includes('*');

          let hasAccess = isGod;
          if (!hasAccess) {
            hasAccess = context.scopes.every((required: string) => {
              if (userScopes.includes(required)) return true;
              return userScopes.some((owned: string) => {
                if (owned.endsWith(':*')) {
                  const prefix = owned.slice(0, -2);
                  return required === prefix || required.startsWith(owned.slice(0, -1));
                }
                return false;
              });
            });
          }

          if (!hasAccess) {
            if (context.onFail) return context.onFail(req, res);
            return res.status(403).json({ error: 'Forbidden', required: context.scopes });
          }
        }

        // 3. Run Roles (OR)
        if (context.roles.length > 0) {
          const user = req.user || {};
          const userRoles = user.roles || [];
          const isGod = userRoles.includes('*');

          let hasRole = isGod || context.roles.some((r: string) => userRoles.includes(r));

          if (!hasRole) {
            if (context.onFail) return context.onFail(req, res);
            return res.status(403).json({ error: 'Forbidden', required: context.roles });
          }
        }

        // 4. Resolve Params & Execute
        const args = await resolver(req, res);
        const result = await (instance as any)[route.propertyKey](...args);

        if (result !== undefined) {
          if (typeof result === 'object' && result !== null) res.json(result);
          else res.send(String(result));
        }
      } catch (e: any) {
        console.error(`ERROR in route [${route.method}] ${route.fullPath}:`, e.stack || e.message);
        if (!res.headersSent && !(res as any).isAborted) {
          res.status(500).json({ error: 'Internal Server Error' });
        }
      }
    };

    app.any(route.fullPath, handler as any);
  }
}

/**
 * ⚡ Specialized O(1) Resolver Generator
 */
function createSpecializedResolver(bag: MetadataBag, key: string | symbol, app: Voltrix) {
  const params = bag.parameters.get(key) || [];

  const mappers = params.map(p => {
    const needsAsync = p.schema || p.transform || p.type === 'body' || p.type === 'custom';

    if (!needsAsync) {
      // Sync fast-path: query, param, header, req, res never await
      let syncResolver: (req: IRequest, res: IResponse) => any;
      switch (p.type) {
        case 'query': syncResolver = (req) => p.key ? req.query[p.key] : req.query; break;
        case 'param': syncResolver = (req) => req.getParam(p.key!) || req.params[p.key!]; break;
        case 'header': syncResolver = (req) => req.header(p.key!); break;
        case 'req': syncResolver = (req) => req; break;
        case 'res': syncResolver = (_, res) => res; break;
        default: syncResolver = () => undefined;
      }
      return syncResolver;
    }

    // Async path: body, custom, or when schema/transform is present
    let baseResolver: (req: IRequest, res: IResponse) => any;
    switch (p.type) {
      case 'body': baseResolver = (req) => req.json(); break;
      case 'query': baseResolver = (req) => p.key ? req.query[p.key] : req.query; break;
      case 'param': baseResolver = (req) => req.getParam(p.key!) || req.params[p.key!]; break;
      case 'header': baseResolver = (req) => req.header(p.key!); break;
      case 'req': baseResolver = (req) => req; break;
      case 'res': baseResolver = (_, res) => res; break;
      case 'custom': baseResolver = (req) => p.transform!(req); break;
      default: baseResolver = () => undefined;
    }

    return async (req: IRequest, res: IResponse) => {
      let val = await baseResolver(req, res);
      if (p.schema) {
        val = await app.runTransform(p.schema, val, p.type, p.key);
      }
      if (p.transform && p.type !== 'custom') {
        val = await p.transform(val, req);
      }
      return val;
    };
  });

  return async (req: IRequest, res: IResponse) => {
    const args = new Array(params.length);
    for (let i = 0; i < params.length; i++) {
      const result = mappers[i]!(req, res);
      args[params[i]!.index] = result instanceof Promise ? await result : result;
    }
    return args;
  };
}