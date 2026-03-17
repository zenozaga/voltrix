import { RouteBuilder } from './route-builder.js';
import type { RouteHandler } from './route-definition.js';
import type { HttpMethod } from '../common/constants.js';

/**
 * Sub-router with an optional path prefix.
 * Routes are collected and later registered on the parent server.
 *
 * @example
 * ```ts
 * const users = createRouter('/v1/users');
 *
 * users.get('/', listHandler).meta('swagger', { summary: 'List users' });
 * users.get('/:id', getHandler);
 * users.post('/', createHandler).validate({ body: userSchema });
 *
 * server.use(users);
 * ```
 */
export class Router {
  private readonly _builders: RouteBuilder[] = [];

  constructor(readonly prefix: string = '') {}

  // ─── HTTP method helpers ──────────────────────────────────────────────────

  get(pattern: string, handler: RouteHandler): RouteBuilder {
    return this._add('GET', pattern, handler);
  }

  post(pattern: string, handler: RouteHandler): RouteBuilder {
    return this._add('POST', pattern, handler);
  }

  put(pattern: string, handler: RouteHandler): RouteBuilder {
    return this._add('PUT', pattern, handler);
  }

  patch(pattern: string, handler: RouteHandler): RouteBuilder {
    return this._add('PATCH', pattern, handler);
  }

  delete(pattern: string, handler: RouteHandler): RouteBuilder {
    return this._add('DELETE', pattern, handler);
  }

  head(pattern: string, handler: RouteHandler): RouteBuilder {
    return this._add('HEAD', pattern, handler);
  }

  options(pattern: string, handler: RouteHandler): RouteBuilder {
    return this._add('OPTIONS', pattern, handler);
  }

  // ─── Internal ─────────────────────────────────────────────────────────────

  /** All builders in this router — read by VoltrixServer during registration. */
  builders(): ReadonlyArray<RouteBuilder> {
    return this._builders;
  }

  private _add(method: HttpMethod, pattern: string, handler: RouteHandler): RouteBuilder {
    const fullPattern = joinPaths(this.prefix, pattern);
    const builder = new RouteBuilder(method, fullPattern, handler);
    this._builders.push(builder);
    return builder;
  }
}

/**
 * Create a sub-router with an optional path prefix.
 * @param prefix - URL prefix applied to all routes in this router.
 */
export function createRouter(prefix = ''): Router {
  return new Router(prefix);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Join a prefix and a route pattern, ensuring exactly one '/' between them.
 * `'/v1'` + `'/users'` → `'/v1/users'`
 * `''`    + `'/users'` → `'/users'`
 */
function joinPaths(prefix: string, pattern: string): string {
  if (!prefix) return pattern.startsWith('/') ? pattern : `/${pattern}`;
  const p = prefix.endsWith('/') ? prefix.slice(0, -1) : prefix;
  const s = pattern.startsWith('/') ? pattern : `/${pattern}`;
  return p + s;
}
