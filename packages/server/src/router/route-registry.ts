import type { RouteDefinition } from './route-definition.js';
import type { HttpMethod } from '../common/constants.js';

/**
 * Route registry — source of truth for all registered routes.
 *
 * Stores the original RouteDefinitions in insertion order.
 * Used for OpenAPI generation, decorator introspection, and adapters.
 * The RadixTree is the runtime matcher; this is the metadata store.
 */
export class RouteRegistry {
  private readonly _routes: RouteDefinition[] = [];

  /** Register a route definition. */
  add(route: RouteDefinition): void {
    this._routes.push(route);
  }

  /** All registered routes in insertion order. */
  all(): ReadonlyArray<RouteDefinition> {
    return this._routes;
  }

  /** Routes filtered by HTTP method. */
  byMethod(method: HttpMethod): RouteDefinition[] {
    return this._routes.filter(r => r.method === method);
  }

  /** Routes filtered by pattern prefix. */
  byPrefix(prefix: string): RouteDefinition[] {
    return this._routes.filter(r => r.pattern.startsWith(prefix));
  }

  /**
   * Routes that have metadata for the given namespace.
   * Useful for tools that scan only their own namespace (e.g. swagger).
   */
  byMeta(namespace: string): RouteDefinition[] {
    return this._routes.filter(r => r.meta.has(namespace));
  }

  /** Total number of registered routes. */
  get count(): number { return this._routes.length; }

  /**
   * Returns a serializable snapshot of the route tree.
   * Each entry omits functions — safe to pass to JSON-based tools.
   */
  toTree(): RouteTreeEntry[] {
    return this._routes.map(r => ({
      method:  r.method,
      pattern: r.pattern,
      meta:    Object.fromEntries(r.meta),
      params:  r.paramNames,
    }));
  }
}

/** A serializable representation of a single route (no functions). */
export interface RouteTreeEntry {
  method:  string;
  pattern: string;
  meta:    Record<string, unknown>;
  params:  string[];
}
