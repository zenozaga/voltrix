import type { IRequest, IResponse } from '@voltrix/express';
import { DecoratorFactory } from '../__internal/decorator-factory.js';

/**
 * 🚀 Role Decorators for Voltrix
 */

export interface RoleOptions {
  roles: string[];
  onFail?: (req: IRequest, res: IResponse) => any;
}

const usedRoles = new Set<string>();

/**
 * Marks a route or controller with required roles.
 */
export function Role(optionsOrFirstRole: string | RoleOptions, ...remainingRoles: string[]) {
  const options: RoleOptions = typeof optionsOrFirstRole === 'string'
    ? { roles: [optionsOrFirstRole, ...remainingRoles] }
    : optionsOrFirstRole;

  options.roles.forEach(r => usedRoles.add(r));

  return DecoratorFactory.create({
    type: 'custom',
    key: 'roles',
    value: options,
  });
}

/**
 * Returns all unique roles used across the application.
 */
Role.getAll = () => Array.from(usedRoles);

export function Public() {
  return DecoratorFactory.create({
    type: 'custom',
    key: 'public',
    value: true,
  });
}
