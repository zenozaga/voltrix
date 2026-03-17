import type { CompiledRoute, RouteMatch } from './route-definition.js';
import type { HttpMethod } from '../common/constants.js';

/**
 * Radix tree node for URL-based routing.
 *
 * Segments are stored in three buckets for O(1) triage per level:
 * - `staticChildren` Map: exact segment matches (most common path)
 * - `paramChild`:  a single `:name` parameter node
 * - `wildcardChild`: a `*` catch-all node
 *
 * Lookup: O(k) where k = number of URL segments.
 * Insert: O(k).
 */
interface RadixNode {
  /** Exact-match children keyed by segment string. */
  staticChildren: Map<string, RadixNode>;
  /** Parameter child node (:name) — at most one per level. */
  paramChild:     RadixNode | null;
  /** Wildcard child (*) — matches the remainder of the path. */
  wildcardChild:  RadixNode | null;
  /** Handlers keyed by HTTP method (uppercase). */
  handlers:       Map<string, CompiledRoute>;
  /** Parameter name at this node if this is a param node. */
  paramName:      string;
}

function createNode(): RadixNode {
  return {
    staticChildren: new Map(),
    paramChild:     null,
    wildcardChild:  null,
    handlers:       new Map(),
    paramName:      '',
  };
}

/**
 * Per-method radix tree for URL routing.
 *
 * Separate trees per method avoid method-check overhead in the match loop.
 * `ANY` method is used for middleware-style catch-alls (served before method-specific handlers).
 */
export class RadixTree {
  private readonly roots = new Map<string, RadixNode>();

  /**
   * Insert a compiled route into the tree.
   * @param method  - HTTP method (uppercase) or 'ANY' for catch-all.
   * @param pattern - URL pattern (e.g. `/users/:id`, `/static/*`).
   * @param route   - The compiled route to store at this path.
   */
  insert(method: HttpMethod | 'ANY', pattern: string, route: CompiledRoute): void {
    if (!this.roots.has(method)) {
      this.roots.set(method, createNode());
    }
    const root = this.roots.get(method)!;
    const segments = splitPattern(pattern);
    insertSegments(root, segments, 0, route);
  }

  /**
   * Look up a route by method and URL path.
   * Returns null if no route matches.
   *
   * @param method - HTTP method (uppercase).
   * @param url    - Raw URL path (no query string).
   */
  match(method: HttpMethod, url: string): RouteMatch | null {
    const root = this.roots.get(method);
    if (!root) return null;

    const segments = splitUrl(url);
    const paramValues: string[] = [];
    const route = matchSegments(root, segments, 0, paramValues);
    if (!route) return null;

    return { route, paramValues };
  }

  /** Returns the set of registered HTTP methods. */
  methods(): string[] {
    return Array.from(this.roots.keys());
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Splits a URL pattern into segments, stripping the leading '/'.
 * `/users/:id/posts` → ['users', ':id', 'posts']
 * `/` → []
 */
function splitPattern(pattern: string): string[] {
  const path = pattern.startsWith('/') ? pattern.slice(1) : pattern;
  if (!path) return [];
  return path.split('/');
}

/**
 * Splits a URL path into segments for matching.
 * Strips query string if present (shouldn't be, but defensive).
 */
function splitUrl(url: string): string[] {
  const q = url.indexOf('?');
  const path = q >= 0 ? url.slice(0, q) : url;
  const p = path.startsWith('/') ? path.slice(1) : path;
  if (!p) return [];
  return p.split('/');
}

function insertSegments(
  node:     RadixNode,
  segments: string[],
  idx:      number,
  route:    CompiledRoute,
): void {
  if (idx === segments.length) {
    node.handlers.set('ROUTE', route);
    return;
  }

  const seg = segments[idx];

  if (seg === '*') {
    if (!node.wildcardChild) node.wildcardChild = createNode();
    insertSegments(node.wildcardChild, segments, idx + 1, route);
    return;
  }

  if (seg.startsWith(':')) {
    if (!node.paramChild) {
      node.paramChild = createNode();
      node.paramChild.paramName = seg.slice(1);
    }
    insertSegments(node.paramChild, segments, idx + 1, route);
    return;
  }

  // Static segment
  let child = node.staticChildren.get(seg);
  if (!child) {
    child = createNode();
    node.staticChildren.set(seg, child);
  }
  insertSegments(child, segments, idx + 1, route);
}

function matchSegments(
  node:        RadixNode,
  segments:    string[],
  idx:         number,
  paramValues: string[],
): CompiledRoute | null {
  if (idx === segments.length) {
    return node.handlers.get('ROUTE') ?? null;
  }

  const seg = segments[idx];

  // 1. Static match — most common, O(1) Map lookup
  const staticChild = node.staticChildren.get(seg);
  if (staticChild) {
    const result = matchSegments(staticChild, segments, idx + 1, paramValues);
    if (result) return result;
  }

  // 2. Parameter match
  if (node.paramChild) {
    paramValues.push(decodeURIComponent(seg));
    const result = matchSegments(node.paramChild, segments, idx + 1, paramValues);
    if (result) return result;
    paramValues.pop(); // backtrack
  }

  // 3. Wildcard — consumes the rest of the URL
  if (node.wildcardChild) {
    paramValues.push(segments.slice(idx).join('/'));
    const result = node.wildcardChild.handlers.get('ROUTE');
    if (result) return result;
    paramValues.pop();
  }

  return null;
}
