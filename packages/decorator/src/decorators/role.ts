import { SecurityRegistry, type IRequest, type IResponse } from '@voltrix/core';
import { DecoratorFactory } from '../__internal/decorator-factory.js';

/**
 * 🚀 Role Decorators for Voltrix
 */

export interface RoleOptions {
  roles: any[];
  onFail?: (req: IRequest, res: IResponse) => any;
}

/**
 * Marks a route or controller with required roles.
 */
export function Role(optionsOrFirstRole: string | RoleOptions, ...remainingRoles: string[]) {
  const options: RoleOptions = typeof optionsOrFirstRole === 'string'
    ? { roles: [optionsOrFirstRole, ...remainingRoles] }
    : optionsOrFirstRole;

  SecurityRegistry.registerRoles(options.roles);

  return DecoratorFactory.create({
    type: 'custom',
    key: 'roles',
    value: options,
  });
}

/**
 * Returns all unique roles used across the application.
 */
Role.getAll = () => SecurityRegistry.getAllRoles();

export function Public() {
  return DecoratorFactory.create({
    type: 'custom',
    key: 'public',
    value: true,
  });
}
