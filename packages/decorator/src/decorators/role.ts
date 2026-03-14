import { DecoratorFactory } from '../__internal/decorator-factory.js';

/**
 * 🚀 Role Decorators for Voltrix (Refactored)
 */

export function Role(...roles: string[]) {
  return DecoratorFactory.create({
    type: 'custom',
    key: 'roles',
    value: roles,
  });
}

export function RequireRoles(...roles: string[]) {
  return DecoratorFactory.create({
    type: 'custom',
    key: 'requiredRoles',
    value: roles,
  });
}

export const Admin = () => Role('admin');
export const User = () => Role('user');
export const Moderator = () => Role('moderator');
export const Owner = () => Role('owner');

export function Public() {
  return DecoratorFactory.create({
    type: 'custom',
    key: 'public',
    value: true,
  });
}

export function Protected() {
  return DecoratorFactory.create({
    type: 'custom',
    key: 'protected',
    value: true,
  });
}
