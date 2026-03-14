import type { IRequest, IResponse } from '@voltrix/express';
import { DecoratorFactory } from '../__internal/decorator-factory.js';

/**
 * 🚀 Scope Decorators for Voltrix
 */

export interface ScopeOptions {
  scopes: string[];
  onFail?: (req: IRequest, res: IResponse) => any;
}

const usedScopes = new Set<string>();

/**
 * Marks a route or controller with required scopes.
 * Usage:
 * @Scope('admin', 'user:write')
 * @Scope({ scopes: ['read'], onFail: (req, res) => res.status(403).json({ error: 'No access' }) })
 */
export function Scope(optionsOrFirstScope: string | ScopeOptions, ...remainingScopes: string[]) {
  const options: ScopeOptions = typeof optionsOrFirstScope === 'string'
    ? { scopes: [optionsOrFirstScope, ...remainingScopes] }
    : optionsOrFirstScope;

  // Track scopes for auditing
  options.scopes.forEach(s => usedScopes.add(s));

  return DecoratorFactory.create({
    type: 'custom',
    key: 'scopes',
    value: options,
  });
}

/**
 * Returns all unique scopes used across the application.
 */
Scope.getAll = () => Array.from(usedScopes);