import type { Ctx } from '../context/context.js';
import type { HookSet } from '../hooks/hook-types.js';
import type { RouteSerializer } from '../serializers/types.js';
import type { RouteValidators } from '../validators/types.js';
import type { CompiledPipeline } from '../hooks/pipeline-runner.js';
import type { HttpMethod } from '../common/constants.js';

/** A route handler receives the unified context and may return a value or nothing. */
export type RouteHandler = (ctx: Ctx) => unknown | Promise<unknown>;

/**
 * Route metadata — stored in the RouteRegistry for introspection.
 * Consumers (swagger, decorators, adapters) read metadata; the server ignores it.
 *
 * Namespaced to prevent conflicts between multiple consumers:
 * ```ts
 * route.meta('swagger', { summary: 'List users', tags: ['Users'] });
 * route.meta('auth',    { roles: ['admin'] });
 * ```
 */
export type RouteMeta = Map<string, unknown>;

/**
 * A fully resolved route definition — produced after all builders are finalized
 * and stored in the RouteRegistry.
 */
export interface RouteDefinition {
  method:     HttpMethod;
  pattern:    string;
  handler:    RouteHandler;
  hooks:      HookSet;
  serializer: RouteSerializer | null;
  validators: RouteValidators | null;
  meta:       RouteMeta;
  /** Parameter names in declaration order — e.g. [':id'] → ['id']. */
  paramNames: string[];
}

/**
 * The compiled route stored in the radix tree for zero-overhead dispatch.
 * All expensive work (hook compilation, param index mapping) is done at startup.
 */
export interface CompiledRoute {
  handler:     RouteHandler;
  onRequest:   CompiledPipeline;
  preHandler:  CompiledPipeline;
  onResponse:  CompiledPipeline;
  serializer:  RouteSerializer | null;
  validators:  RouteValidators | null;
  paramNames:  string[];
}

/**
 * Result of a radix tree lookup.
 * Returns the compiled route and extracted parameter values.
 */
export interface RouteMatch {
  route:       CompiledRoute;
  paramValues: string[];
}
