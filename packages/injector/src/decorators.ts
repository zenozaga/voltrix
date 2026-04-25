import type { Constructor, Token } from '.\/providers.js';
import { defineMetadata, META } from '.\/metadata.js';
import { InjectableStore } from '.\/utils/injectable-store.js';

export interface InjectableOptions {
  token?: Token;
  scope?: 'singleton' | 'transient' | 'scoped';
  lifetimeMs?: number;
  timeoutMs?: number;
}

type InjectOptions = { optional?: boolean };
type InjectedProp = {
  key: string | symbol;
  token: unknown;
  optional?: boolean;
};

type SugarOptions = number | { timeoutMs?: number; lifetimeMs?: number };

function isFunction(value: unknown): value is Function {
  return typeof value === 'function';
}

function isSymbol(value: unknown): value is symbol {
  return typeof value === 'symbol';
}

function isInjectableOptions(value: unknown): value is InjectableOptions {
  if (!value || typeof value !== 'object') return false;
  if (isFunction(value) || isSymbol(value)) return false;
  return true;
}

function normalizeInjectableOptions(
  optionsOrToken?: Token | InjectableOptions
): InjectableOptions {
  if (optionsOrToken == null) return {};
  return isInjectableOptions(optionsOrToken)
    ? optionsOrToken
    : { token: optionsOrToken as Token };
}

export function Injectable(optionsOrToken: Token | InjectableOptions = {}) {
  const options = normalizeInjectableOptions(optionsOrToken);
  const { scope, lifetimeMs, timeoutMs, token } = options;

  return <T extends Constructor>(target: T): T => {
    defineMetadata(META.INJECTABLE, true, target);

    if (scope !== undefined) {
      defineMetadata(META.SCOPE, scope, target);
    }

    if (typeof lifetimeMs === 'number') {
      defineMetadata(META.LIFETIME, lifetimeMs, target);
    }

    if (typeof timeoutMs === 'number') {
      defineMetadata(META.TIMEOUT, timeoutMs, target);
    }

    if (token !== undefined) {
      defineMetadata(META.TOKEN, token, target);
    }

    InjectableStore.add(token ?? target, target);
    return target;
  };
}

export function Inject(token?: unknown, options?: InjectOptions) {
  const optional = options?.optional === true;

  return (
    target: object,
    propertyKey?: string | symbol,
    parameterIndex?: number
  ): void => {
    let resolvedToken = token;

    if (resolvedToken === undefined) {
      if (typeof parameterIndex === 'number') {
        const types = Reflect.getMetadata('design:paramtypes', target) as unknown[] | undefined;
        resolvedToken = types?.[parameterIndex];
      } else if (propertyKey !== undefined) {
        resolvedToken = Reflect.getMetadata('design:type', target, propertyKey);
      }
    }

    if (typeof parameterIndex === 'number') {
      const existingDeps =
        (Reflect.getOwnMetadata(META.INJECT_TOKENS, target) as unknown[] | undefined) ?? [];

      if (existingDeps[parameterIndex] !== resolvedToken) {
        existingDeps[parameterIndex] = resolvedToken;
        Reflect.defineMetadata(META.INJECT_TOKENS, existingDeps, target);
      }

      if (optional) {
        Reflect.defineMetadata(META.INJECT_OPTIONAL, true, target, String(parameterIndex));
      }

      return;
    }

    if (propertyKey === undefined) {
      return;
    }

    const ctor = (target as { constructor: Function }).constructor;
    const existingProps =
      (Reflect.getOwnMetadata(META.INJECT_PROPS, ctor) as InjectedProp[] | undefined) ?? [];

    existingProps.push({
      key: propertyKey,
      token: resolvedToken,
      optional,
    });

    Reflect.defineMetadata(META.INJECT_PROPS, existingProps, ctor);
  };
}

const normalizeSugar = (
  opts?: SugarOptions
): Pick<InjectableOptions, 'timeoutMs' | 'lifetimeMs'> => {
  if (typeof opts === 'number') {
    return { timeoutMs: opts };
  }

  return opts ?? {};
};

function scoped(scope: NonNullable<InjectableOptions['scope']>) {
  return (opts?: SugarOptions) =>
    Injectable({
      scope,
      ...normalizeSugar(opts),
    });
}

export const Scoped = scoped('scoped');
export const Singleton = scoped('singleton');
export const Transient = scoped('transient');
