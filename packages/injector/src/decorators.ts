import type { Constructor } from './providers';
import { defineMetadata, META } from './metadata';
import { InjectableStore } from './utils/injectable-store';

/**
 * Options for marking a class as injectable.
 */
export interface InjectableOptions {
  scope?: 'singleton' | 'transient' | 'scoped';
  lifetimeMs?: number;
  timeoutMs?: number;
}

/**
 * Marks a class as injectable and optionally sets metadata
 * for its lifecycle or custom timeouts.
 */
export function Injectable(options: InjectableOptions = {}) {
  return <T extends Constructor>(target: T): T => {
    defineMetadata(META.INJECTABLE, true, target);

    const { scope, lifetimeMs, timeoutMs } = options;
    if (scope) defineMetadata(META.SCOPE, scope, target);
    if (typeof lifetimeMs === 'number') defineMetadata(META.LIFETIME, lifetimeMs, target);
    if (typeof timeoutMs === 'number') defineMetadata(META.TIMEOUT, timeoutMs, target);

    InjectableStore.add(target);

    return target;
  };
}

/**
 * Marks a constructor parameter or property for dependency injection.
 *
 * Usage:
 *   constructor(@Inject(Logger) private logger: Logger) {}
 *   @Inject(ConfigService) private config!: ConfigService;
 */
export function Inject(token: unknown, options?: { optional?: boolean }) {
  return (target: Object, propertyKey?: string | symbol, index?: number): void => {
    // --- Constructor parameter injection ---
    if (typeof index === 'number') {
      const existingDeps = Reflect.getOwnMetadata(META.INJECT_TOKENS, target) as
        | unknown[]
        | undefined;
      const updatedDeps = existingDeps ? [...existingDeps] : [];
      updatedDeps[index] = token;
      Reflect.defineMetadata(META.INJECT_TOKENS, updatedDeps, target);

      if (options?.optional) {
        Reflect.defineMetadata(META.INJECT_OPTIONAL, true, target, index.toString());
      }
      return;
    }

    // --- Property injection ---
    const existingProps =
      (Reflect.getOwnMetadata(META.INJECT_PROPS, target.constructor) as
        | Array<{ key: string | symbol; token: unknown; optional?: boolean }>
        | undefined) ?? [];

    existingProps.push({ key: propertyKey!, token, optional: options?.optional });
    Reflect.defineMetadata(META.INJECT_PROPS, existingProps, target.constructor);
  };
}

/* -------------------------------------------------------------------------- */
/* 🧂 Syntactic sugar helpers                                                  */
/* -------------------------------------------------------------------------- */

type SugarOptions = number | { timeoutMs?: number; lifetimeMs?: number };

const normalizeSugar = (
  opts?: SugarOptions
): Pick<InjectableOptions, 'timeoutMs' | 'lifetimeMs'> =>
  typeof opts === 'number' ? { timeoutMs: opts } : (opts ?? {});

function scoped(scope: NonNullable<InjectableOptions['scope']>) {
  return (opts?: SugarOptions) => Injectable({ scope, ...normalizeSugar(opts) });
}

export const Scoped = scoped('scoped');
export const Singleton = scoped('singleton');
export const Transient = scoped('transient');
