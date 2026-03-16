import { Router } from '@voltrix/express';
import { OpenAPIDoc, SwaggerOptions, OpenApiMetadata } from '../core/types';
import { SpecBuilder } from '../core/builder';

/**
 * Generates an OpenAPI specification from a pure Voltrix Router
 */
export function generateFromRouter(router: Router, options: SwaggerOptions = {}): OpenAPIDoc {
  const spec = SpecBuilder.createBase(options);
  const routes = router.getFlattenedRoutes();

  for (const route of routes) {
    const meta = (route.meta || {}) as OpenApiMetadata;
    
    if (options.namespace && meta.namespace !== options.namespace) continue;
    if (meta.exclude) continue;

    SpecBuilder.addPath(spec, route.fullPattern, route.method, meta);
  }

  return spec;
}
