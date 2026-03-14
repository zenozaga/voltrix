import { DecoratorFactory } from '../__internal/decorator-factory.js';

/**
 * 🚀 Scope Decorators for Voltrix (Refactored)
 */

export function Scope(...scopes: string[]) {
  return DecoratorFactory.create({
    type: 'custom',
    key: 'scopes',
    value: scopes,
  });
}

export function RequireScopes(...scopes: string[]) {
  return DecoratorFactory.create({
    type: 'custom',
    key: 'requiredScopes',
    value: scopes,
  });
}

export const Read = () => Scope('read');
export const Write = () => Scope('write');
export const DeleteScope = () => Scope('delete');
export const AdminScope = () => Scope('admin');
export const UserScope = () => Scope('user');

export function ReadResource(resource: string) {
  return Scope(`read:${resource}`);
}

export function WriteResource(resource: string) {
  return Scope(`write:${resource}`);
}

export function DeleteResource(resource: string) {
  return Scope(`delete:${resource}`);
}
//   <T extends string = string>( scopes: ScopeType<T> ): ClassDecorator & MethodDecorator & ParameterDecorator =>
//   (target: any, propertyKey?: any, descriptorOrIndex?: any) => {
//     const { isProperty } = who(target, propertyKey, descriptorOrIndex);

//     if (isProperty) {
//       throw new Error(
//         `Scope decorator cannot be used as parameter decorator in ${target.constructor.name}.${propertyKey}`
//       );
//     }

//     const list = MetadatStore.list<ScopeType>(KEY_PARAMS_SCOPE, {
//       target,
//       propertyKey,
//     });

//     list.set(...(Array.isArray(scopes) ? scopes : [scopes]));
//   };
