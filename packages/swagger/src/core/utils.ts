/**
 * Normalizes a path by removing redundant slashes and trailing slashes (except for root)
 */
export function normalizePath(path: string): string {
  let normalized = path.replace(/\/+/g, '/');
  if (normalized !== '/' && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  // Convert Express style :id to OpenAPI {id}
  return normalized.replace(/:([^/]+)/g, '{$1}');
}

/**
 * Extracts path parameter names from a normalized OpenAPI path (e.g., /users/{id} -> ['id'])
 */
export function extractPathParams(normalizedPath: string): string[] {
  const matches = normalizedPath.match(/{[^}]+}/g) || [];
  return matches.map(p => p.slice(1, -1));
}
