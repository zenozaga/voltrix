import { SecurityRegistry, type IRequest, type IResponse } from '@voltrix/core';
import { DecoratorFactory } from '../__internal/decorator-factory.js';
import { CUSTOM_KEYS } from '../__internal/metadata-registry.js';

/**
 * 🚀 Scope Decorators for Voltrix
 */

export interface ScopeOptions {
  scopes: any[];
  onFail?: (req: IRequest, res: IResponse) => any;
}

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

  SecurityRegistry.registerScopes(options.scopes);

  return DecoratorFactory.create({
    type: 'custom',
    key: CUSTOM_KEYS.SCOPES,
    value: options,
  });
}

/**
 * Returns all unique scopes used across the application.
 */
Scope.getAll = () => SecurityRegistry.getAllScopes();
