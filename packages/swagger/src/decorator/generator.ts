import { AppTree, ModuleNode, ControllerNode } from '@voltrix/core';
import { OpenAPIDoc, SwaggerOptions, OpenApiMetadata } from '../core/types';
import { SpecBuilder } from '../core/builder';

/**
 * Generates an OpenAPI specification from a decorative Voltrix AppTree
 */
export function generateFromTree(tree: AppTree, options: SwaggerOptions = {}): OpenAPIDoc {
  const spec = SpecBuilder.createBase(options);

  for (const mod of tree.modules) {
    processModuleNode(mod, spec, options);
  }

  return spec;
}

export function processModuleNode(node: ModuleNode, spec: OpenAPIDoc, options: SwaggerOptions): void {
  for (const ctrl of (node.controllers || [])) {
    processControllerNode(ctrl, spec, options);
  }

  for (const sub of (node.subModules || [])) {
    processModuleNode(sub, spec, options);
  }
}

export function processControllerNode(node: ControllerNode, spec: OpenAPIDoc, options: SwaggerOptions): void {
  const ctrlMeta = (node.meta.openapi || {}) as OpenApiMetadata;

  for (const route of (node.routes || [])) {
    const routeOpenApi = (route.meta.openapi || {}) as OpenApiMetadata;

    // Merge controller level namespace/tags if applicable
    if (ctrlMeta.namespace && !routeOpenApi.namespace) {
      routeOpenApi.namespace = ctrlMeta.namespace;
    }
    
    if (ctrlMeta.tags) {
      routeOpenApi.tags = Array.from(new Set([...(ctrlMeta.tags || []), ...(routeOpenApi.tags || [])]));
    }

    if (options.namespace && routeOpenApi.namespace !== options.namespace) continue;
    if (routeOpenApi.exclude || ctrlMeta.exclude) continue;

    SpecBuilder.addPath(spec, route.fullPath, route.method, routeOpenApi);
  }
}
