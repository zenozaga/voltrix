import type { Constructor, Token } from './providers';
import { defineMetadata, META, getMetadata } from './metadata';
import { InjectableStore } from './utils/injectable-store';

/**
 * Options for marking a class as injectable.
 */
export interface InjectableOptions {
  token?: Token;
  scope?: 'singleton' | 'transient' | 'scoped';
  lifetimeMs?: number;
  timeoutMs?: number;
}

/**
 * Marks a class as injectable and optionally sets metadata
 * for its lifecycle or custom timeouts.
 *
 * Usage:
 *  @Injectable()
 *  @Injectable(IUserRepository)
 *  @Injectable({ scope: 'transient' })
 */
export function Injectable(optionsOrToken: Token | InjectableOptions = {}) {
  return <T extends Constructor>(target: T): T => {
    defineMetadata(META.INJECTABLE, true, target);

    let options: InjectableOptions = {};
    if (typeof optionsOrToken === 'object' && !('name' in optionsOrToken) && !((optionsOrToken as any) instanceof Symbol)) {
      // It's an options object (heuristic for not being a constructor or symbol)
      options = optionsOrToken as InjectableOptions;
    } else if (optionsOrToken) {
      // It's a token
      options = { token: optionsOrToken as Token };
    }

    const { scope, lifetimeMs, timeoutMs, token } = options;
    if (scope) defineMetadata(META.SCOPE, scope, target);
    if (typeof lifetimeMs === 'number') defineMetadata(META.LIFETIME, lifetimeMs, target);
    if (typeof timeoutMs === 'number') defineMetadata(META.TIMEOUT, timeoutMs, target);
    if (token) defineMetadata(META.TOKEN, token, target);

    InjectableStore.add(token ?? target, target);

    return target;
  };
}

/**
 * Marks a constructor parameter or property for dependency injection.
 *
 * Usage:
 *   constructor(@Inject(Logger) private logger: Logger) {}
 *   constructor(@Inject() private logger: Logger) {}
 *   @Inject() private config!: ConfigService;
 */
export function Inject(token?: unknown, options?: { optional?: boolean }) {
  return (target: any, propertyKey?: any, index?: number): void => {
    let resolvedToken = token;

    if (!resolvedToken) {
      if (typeof index === 'number') {
        const types = Reflect.getMetadata('design:paramtypes', target);
        resolvedToken = types?.[index];
      } else if (propertyKey) {
        resolvedToken = Reflect.getMetadata('design:type', target, propertyKey);
      }
    }

    // --- Constructor parameter injection ---
    if (typeof index === 'number') {
      const existingDeps = Reflect.getOwnMetadata(META.INJECT_TOKENS, target) as
        | unknown[]
        | undefined;
      const updatedDeps = existingDeps ? [...existingDeps] : [];
      updatedDeps[index] = resolvedToken;
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

    existingProps.push({ key: propertyKey!, token: resolvedToken, optional: options?.optional });
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
