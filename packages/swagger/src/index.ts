import { AppTree, ModuleNode, ControllerNode } from '@voltrix/core';
import { Router } from '@voltrix/express';

export * from './ui.js';

export interface SwaggerOptions {
  title?: string;
  version?: string;
  description?: string;
  namespace?: string;
  servers?: { url: string; description?: string }[];
}

export class SwaggerAssembler {
  /**
   * Generate OpenAPI JSON from an AppTree or Router
   */
  static generate(input: AppTree | Router, options: SwaggerOptions = {}): any {
    const spec: any = {
      openapi: '3.0.0',
      info: {
        title: options.title || 'Voltrix API',
        version: options.version || '1.0.0',
        description: options.description || '',
      },
      servers: options.servers || [],
      paths: {},
      components: {
        schemas: {},
        securitySchemes: {},
      },
    };

    if (input instanceof Router) {
      this.processRouter(input, spec, options);
    } else {
      this.processAppTree(input, spec, options);
    }

    return spec;
  }

  private static processRouter(router: Router, spec: any, options: SwaggerOptions): void {
    const routes = router.getFlattenedRoutes();
    for (const route of routes) {
      const openapi = route.meta || {};
      if (options.namespace && openapi.namespace !== options.namespace) continue;
      if (openapi.exclude) continue;

      this.addPath(spec, route.fullPattern, route.method, openapi);
    }
  }

  private static processAppTree(tree: AppTree, spec: any, options: SwaggerOptions): void {
    for (const mod of tree.modules) {
      this.processModuleNode(mod, spec, options);
    }
  }

  private static processModuleNode(node: ModuleNode, spec: any, options: SwaggerOptions): void {
    const modOpenApi = node.meta.openapi || {};
    for (const ctrl of (node.controllers || [])) {
      this.processControllerNode(ctrl, spec, options);
    }

    for (const sub of (node.subModules || [])) {
      this.processModuleNode(sub, spec, options);
    }
  }

  private static processControllerNode(node: ControllerNode, spec: any, options: SwaggerOptions): void {
    const ctrlOpenApi = node.meta.openapi || {};

    for (const route of (node.routes || [])) {
      const routeOpenApi = route.meta.openapi || {};
      
      if (options.namespace && routeOpenApi.namespace !== options.namespace) continue;
      if (routeOpenApi.exclude) continue;

      this.addPath(spec, route.fullPath, route.method, routeOpenApi);
    }
  }

  private static addPath(spec: any, path: string, method: string, meta: any): void {
    const normalizedPath = path.replace(/:([^/]+)/g, '{$1}');
    const m = method.toLowerCase();

    if (!spec.paths[normalizedPath]) spec.paths[normalizedPath] = {};
    
    const operation = {
      summary: meta.summary,
      description: meta.description,
      operationId: meta.operationId,
      tags: meta.tags || [],
      deprecated: meta.deprecated,
      security: meta.security,
      parameters: meta.parameters || [],
      requestBody: meta.requestBody,
      responses: meta.responses || {
        '200': { description: 'OK' }
      },
    };

    // Extract path parameters automatically from normalizedPath if not explicitly defined
    const pathParams = (normalizedPath.match(/{[^}]+}/g) || []).map(p => p.slice(1, -1));
    for (const p of pathParams) {
      if (!operation.parameters.some((idx: any) => idx.name === p && idx.in === 'path')) {
        operation.parameters.push({
          name: p,
          in: 'path',
          required: true,
          schema: { type: 'string' }
        });
      }
    }

    // Merge extensions
    for (const key of Object.keys(meta)) {
      if (key.startsWith('x-')) {
        (operation as any)[key] = meta[key];
      }
    }

    spec.paths[normalizedPath][m] = operation;
  }
}
