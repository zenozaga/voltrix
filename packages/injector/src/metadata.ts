import type { Constructor, Token, AbstractConstructor } from './providers';

type ClassLike<T = unknown> = Constructor<T> | AbstractConstructor<T>;
type InjectedProp = {
  key: string | symbol;
  token: unknown;
  optional?: boolean;
};

export const META = {
  INJECT: Symbol('__voltrix__inject'),
  INJECTABLE: Symbol('__voltrix__injectable'),
  INJECT_OPTIONAL: Symbol('__voltrix__inject:optional'),
  INJECT_TOKENS: Symbol('__voltrix__inject:tokens'),
  INJECT_PROPS: Symbol('__voltrix__inject:properties'),
  SCOPE: Symbol('__voltrix__scope'),
  LIFETIME: Symbol('__voltrix__lifetime'),
  TIMEOUT: Symbol('__voltrix__timeout'),
  TOKEN: Symbol('__voltrix__token'),
} as const;

const paramTypesCache = new WeakMap<ClassLike, Token[] | null>();
const injectTokensCache = new WeakMap<object, Token[] | undefined>();
const injectPropsCache = new WeakMap<ClassLike, InjectedProp[] | undefined>();

export function getDesignParamTypes(target: ClassLike): Token[] | null {
  const cached = paramTypesCache.get(target);
  if (cached !== undefined) return cached;

  const result = (Reflect.getMetadata('design:paramtypes', target) as Token[] | undefined) ?? null;
  paramTypesCache.set(target, result);
  return result;
}

export function getInjectedTokens(target: object): Token[] | undefined {
  if (injectTokensCache.has(target)) {
    return injectTokensCache.get(target);
  }

  const result = Reflect.getOwnMetadata(META.INJECT_TOKENS, target) as Token[] | undefined;
  injectTokensCache.set(target, result);
  return result;
}

export function getInjectedProps<T = unknown>(
  target: Constructor<T> | AbstractConstructor<T>
): InjectedProp[] | undefined {
  if (injectPropsCache.has(target)) {
    return injectPropsCache.get(target);
  }

  const result = Reflect.getOwnMetadata(META.INJECT_PROPS, target) as InjectedProp[] | undefined;
  injectPropsCache.set(target, result);
  return result;
}

export function getInjectedOptional(target: object, index: number): boolean {
  return Reflect.getOwnMetadata(META.INJECT_OPTIONAL, target, String(index)) === true;
}

export function defineMetadata(key: symbol, value: unknown, target: object): void {
  Reflect.defineMetadata(key, value, target);
}

export function getMetadata<T = unknown>(key: symbol, target: object): T | undefined {
  return Reflect.getMetadata(key, target) as T | undefined;
}

export function getAllMetadata<T = unknown>(target: object): Map<symbol, T> {
  const metadata = new Map<symbol, T>();
  const keys = Reflect.getMetadataKeys(target) as symbol[];

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    metadata.set(key, Reflect.getMetadata(key, target) as T);
  }

  return metadata;
}

export function isMetadataEqual<T = unknown>(key: symbol, value: T, target: object): boolean {
  return Reflect.getMetadata(key, target) === value;
}