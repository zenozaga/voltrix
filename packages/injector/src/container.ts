import 'reflect-metadata';
import {
  ProviderNotFoundError,
  CircularDependencyError,
  InvalidProviderError,
} from './errors';
import { InjectableStore } from './utils/injectable-store';
import { Hooks } from './hooks';

import type {
  Provider,
  Token,
  Constructor,
  ContainerOptions,
  ProviderKind,
  ProviderResolver,
  FactoryProvider,
  AbstractConstructor,
} from './providers';

import {
  META,
  getDesignParamTypes,
  getInjectedTokens,
  getInjectedProps,
  getMetadata,
  getInjectedOptional,
} from './metadata';

type FactoryFn<T = unknown> = (args: unknown[]) => T;
type InstanceRecord = { value: unknown; expiresAt?: number };

type MiddlewareContext<T = unknown> = {
  token: Token<T>;
  provider?: Provider<T> | null;
  container: DIContainer;
  next: () => T;
};

type MiddlewareFn<T = unknown> = (ctx: MiddlewareContext<T>) => T;

type CachedClassData<T = unknown> = {
  deps: Token[];
  factory: FactoryFn<T>;
  propInjections: Array<{ key: PropertyKey; token: Token; optional?: boolean }>;
  propInjectionKeys: Set<PropertyKey>;
  autoInjectKeys: PropertyKey[];
};

const DISPOSERS = ['dispose', 'destroy', 'close'] as const;

export const aSymbols = META;

export class DIContainer {
  private readonly providers = new Map<Token, Provider>();
  private readonly instances = new Map<Token, InstanceRecord>();
  private readonly hooks = new Hooks();
  private readonly middlewares: MiddlewareFn[] = [];
  private readonly opts: Required<ContainerOptions>;
  private readonly resolvers: Record<ProviderKind, ProviderResolver>;
  private hasMiddleware = false;

  private static _global?: DIContainer;
  private static readonly classCache = new WeakMap<Function, CachedClassData>();

  constructor(
    private readonly parent?: DIContainer,
    opts: ContainerOptions = {}
  ) {
    this.opts = {
      autoInject: opts.autoInject ?? true,
      defaultScope: opts.defaultScope ?? 'singleton',
      defaultTimeoutMs: opts.defaultTimeoutMs ?? 0,
    };

    this.resolvers = {
      class: this.instantiateClass.bind(this) as ProviderResolver,
      factory: this.instantiateFactory.bind(this) as ProviderResolver,
      value: this.instantiateValue.bind(this) as ProviderResolver,
      existing: this.instantiateExisting.bind(this) as ProviderResolver,
    };
  }

  static get global(): DIContainer {
    if (!this._global) this._global = new DIContainer();
    return this._global;
  }

  static create(opts?: ContainerOptions): DIContainer {
    return new DIContainer(undefined, opts);
  }

  createChild(opts?: ContainerOptions): DIContainer {
    return new DIContainer(this, opts ?? this.opts);
  }

  on(
    handler: (ev: {
      type: 'create' | 'resolve' | 'dispose';
      token: Token;
      instance: unknown;
    }) => void
  ): () => void {
    return this.hooks.on(handler);
  }

  use(fn: MiddlewareFn): void {
    this.middlewares.push(fn);
    this.hasMiddleware = this.middlewares.length > 0;
  }

  register<T>(provider: Omit<Provider<T>, 'kind'>): void {
    const token = provider.token ?? provider.provide;
    if (!token) {
      throw new InvalidProviderError('Provider must define a token or provide property');
    }

    const kind = this.detectProviderKind(provider);
    if (!kind) {
      throw new InvalidProviderError(`Invalid provider configuration for ${this.tokenToString(token)}`);
    }

    const normalized = { ...provider, kind, token } as Provider<T>;

    if (kind === 'existing') {
      (normalized as Provider<T>).useExisting =
        (provider as Provider<T>).useExisting ?? (provider as { useToken?: Token<T> }).useToken;
    }

    const target = (provider as Provider<T>).useClass as Constructor<T> | undefined;
    if (target) {
      this.applyMetadata(target, normalized);
      this.prepareClassProvider(normalized, target);
    }

    if (kind === 'factory') {
      this.prepareFactoryProvider(normalized as FactoryProvider<T>);
    }

    this.providers.set(token, normalized);
  }

  registerMany(
    providers: Array<Constructor | AbstractConstructor | Omit<Provider<unknown>, 'kind'>>
  ): void {
    for (const provider of providers) {
      if (typeof provider === 'function') {
        this.register({ token: provider, useClass: provider as Constructor });
      } else {
        this.register(provider);
      }
    }
  }

  addProvider<T>(provider: Constructor<T> | Omit<Provider<T>, 'kind'> | null | undefined): void {
    if (!provider) return;

    if (typeof provider === 'function') {
      this.register({ token: provider, useClass: provider });
      return;
    }

    this.register(provider);
  }

  get<T>(token: Token<T>): T {
    return this.resolve(token);
  }

  has(token: Token): boolean {
    return this.providers.has(token) || !!this.parent?.has(token);
  }

  resolve<T>(token: Token<T>, stack?: Set<Token>): T {
    const cached = this.instances.get(token);
    if (cached && !this.isExpired(cached)) {
      return this.emitResolveIfNeeded(token, cached.value as T);
    }

    if (cached) {
      this.instances.delete(token);
    }

    this.ensureAutoProvider(token);

    const provider = this.providers.get(token) as Provider<T> | undefined;
    if (!provider) {
      if (this.parent) return this.parent.resolve(token, stack);
      throw new ProviderNotFoundError(`No provider found for ${this.tokenToString(token)}`);
    }

    const activeStack = stack ?? new Set<Token>();
    if (activeStack.has(token)) {
      throw this.circularError(token, activeStack);
    }

    activeStack.add(token);

    try {
      const createInstance = (): T => {
        const instance = this.instantiate(provider, activeStack);
        this.maybeCache(token, provider, instance);
        this.emitCreateAndResolveIfNeeded(token, instance);
        return instance;
      };

      return this.hasMiddleware
        ? this.runMiddlewares(token, provider, createInstance)
        : createInstance();
    } finally {
      activeStack.delete(token);
    }
  }

  dispose(token: Token): void {
    const record = this.instances.get(token);
    if (!record) return;

    this.instances.delete(token);

    const instance = record.value as Record<string, unknown>;
    for (let i = 0; i < DISPOSERS.length; i++) {
      const method = DISPOSERS[i];
      const disposer = instance?.[method];
      if (typeof disposer === 'function') {
        (disposer as () => void)();
        break;
      }
    }

    if (this.hooks.hasListeners) {
      this.hooks.emit({ type: 'dispose', token, instance: record.value });
    }
  }

  clear(): void {
    for (const token of this.instances.keys()) {
      this.dispose(token);
    }

    this.providers.clear();
  }

  getInstances(): unknown[] {
    const values: unknown[] = new Array(this.instances.size);
    let index = 0;

    for (const record of this.instances.values()) {
      values[index++] = record.value;
    }

    return values;
  }

  count(): number {
    return this.providers.size;
  }

  private runMiddlewares<T>(
    token: Token<T>,
    provider: Provider<T>,
    resolver: () => T
  ): T {
    let index = -1;

    const dispatch = (i: number): T => {
      if (i <= index) {
        throw new Error('next() called more than once in middleware');
      }

      index = i;

      const middleware = this.middlewares[i] as MiddlewareFn<T> | undefined;
      if (!middleware) return resolver();

      return middleware({
        token,
        provider,
        container: this,
        next: () => dispatch(i + 1),
      });
    };

    return dispatch(0);
  }

  private instantiate<T>(provider: Provider<T>, stack: Set<Token>): T {
    const resolver = this.resolvers[provider.kind];
    if (!resolver) {
      throw new InvalidProviderError(`Invalid provider for ${this.tokenToString(provider.token)}`);
    }

    return resolver(provider, stack) as T;
  }

  private instantiateClass<T>(provider: Provider<T>, stack: Set<Token>): T {
    const cls = provider.useClass as Constructor<T>;
    const cached = this.getOrCreateClassCache(cls, provider);

    const deps = cached.deps;
    const args = deps.length ? new Array(deps.length) : [];

    for (let i = 0; i < deps.length; i++) {
      const depToken = deps[i];

      if (!depToken) {
        args[i] = undefined;
        continue;
      }

      try {
        args[i] = this.resolve(depToken, stack);
      } catch (error) {
        if (getInjectedOptional(cls, i) === true) {
          args[i] = undefined;
        } else {
          throw error;
        }
      }
    }

    const instance = cached.factory(args);
    this.applyPropertyInjections(instance, cls, cached, stack);

    return instance;
  }

  private instantiateFactory<T>(provider: Provider<T>, stack: Set<Token>): T {
    const deps = provider.inject ?? [];
    if (deps.length === 0) {
      return (provider as FactoryProvider<T>).useFactory() as T;
    }

    const args = new Array(deps.length);
    for (let i = 0; i < deps.length; i++) {
      args[i] = this.resolve(deps[i], stack);
    }

    const factory = (provider as FactoryProvider<T>).useFactory;
    return factory(...args) as T;
  }

  private instantiateValue<T>(provider: Provider<T>): T {
    return provider.useValue as T;
  }

  private instantiateExisting<T>(provider: Provider<T>, stack: Set<Token>): T {
    return this.resolve(provider.useExisting as Token<T>, stack);
  }

  private applyMetadata<T>(target: Constructor<T>, provider: Provider<T>): void {
    const metaScope = getMetadata(META.SCOPE, target);
    if (metaScope && !provider.scope) provider.scope = metaScope as Provider<T>['scope'];

    const metaLifetime = getMetadata(META.LIFETIME, target);
    if (metaLifetime && !provider.lifetimeMs) provider.lifetimeMs = metaLifetime as number;

    const metaTimeout = getMetadata(META.TIMEOUT, target);
    if (metaTimeout && !provider.timeoutMs) provider.timeoutMs = metaTimeout as number;
  }

  private applyPropertyInjections<T>(
    instance: T,
    cls: Constructor<T>,
    cached: CachedClassData<T>,
    stack: Set<Token>
  ): void {
    const propInjections = cached.propInjections;

    for (let i = 0; i < propInjections.length; i++) {
      const meta = propInjections[i];
      try {
        (instance as Record<PropertyKey, unknown>)[meta.key] = this.resolve(meta.token, stack);
      } catch (error) {
        if (!meta.optional) throw error;
      }
    }

    if (!this.opts.autoInject || cached.autoInjectKeys.length === 0) {
      return;
    }

    const proto = cls.prototype;
    const target = instance as Record<PropertyKey, unknown>;

    for (let i = 0; i < cached.autoInjectKeys.length; i++) {
      const key = cached.autoInjectKeys[i];
      const designType = Reflect.getMetadata('design:type', proto, key as string);

      if (typeof designType !== 'function' || !this.has(designType)) {
        continue;
      }

      try {
        target[key] = this.resolve(designType, stack);
      } catch {
        // Ignore failed optional-style auto injections.
      }
    }
  }

  private getOrCreateClassCache<T>(
    cls: Constructor<T>,
    provider: Provider<T>
  ): CachedClassData<T> {
    const existing = DIContainer.classCache.get(cls) as CachedClassData<T> | undefined;
    if (existing) return existing;

    const deps = this.getDeps(provider, cls);
    const propInjections = getInjectedProps(cls) ?? [];
    const propInjectionKeys = new Set<PropertyKey>();
    for (let i = 0; i < propInjections.length; i++) {
      propInjectionKeys.add(propInjections[i].key);
    }

    const autoInjectKeys = this.opts.autoInject
      ? this.getAutoInjectKeys(cls, propInjectionKeys)
      : [];

    const cached: CachedClassData<T> = {
      deps,
      factory: this.makeConstructorFactory(cls, deps.length),
      propInjections: propInjections as any,
      propInjectionKeys,
      autoInjectKeys,
    };

    DIContainer.classCache.set(cls, cached);
    return cached;
  }

  private getAutoInjectKeys<T>(
    cls: Constructor<T>,
    excludedKeys: Set<PropertyKey>
  ): PropertyKey[] {
    const proto = cls.prototype;
    const keys = Reflect.ownKeys(proto);
    const result: PropertyKey[] = [];

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      if (key === 'constructor' || excludedKeys.has(key)) continue;

      const descriptor = Object.getOwnPropertyDescriptor(proto, key);
      if (!descriptor || typeof descriptor.value === 'function') continue;

      result.push(key);
    }

    return result;
  }

  private getDeps(provider: Provider, target: Constructor): Token[] {
    if (provider.inject !== undefined) {
      return provider.inject;
    }

    if (!this.opts.autoInject) {
      return [];
    }

    return getInjectedTokens(target) ?? getDesignParamTypes(target) ?? [];
  }

  private makeConstructorFactory<T>(Ctor: Constructor<T>, len: number): FactoryFn<T> {
    switch (len) {
      case 0:
        return () => new Ctor();
      case 1:
        return (args) => new Ctor(args[0] as never);
      case 2:
        return (args) => new Ctor(args[0] as never, args[1] as never);
      case 3:
        return (args) => new Ctor(args[0] as never, args[1] as never, args[2] as never);
      case 4:
        return (args) =>
          new Ctor(args[0] as never, args[1] as never, args[2] as never, args[3] as never);
      default:
        return (args) => new Ctor(...(args as ConstructorParameters<Constructor<T>>));
    }
  }

  private prepareClassProvider<T>(provider: Provider<T>, cls: Constructor<T>): void {
    const cached = this.getOrCreateClassCache(cls, provider);
    (provider as Provider<T> & { deps?: Token[]; factory?: FactoryFn<T> }).deps = cached.deps;
    (provider as Provider<T> & { factory?: FactoryFn<T> }).factory = cached.factory;
  }

  private prepareFactoryProvider<T>(provider: FactoryProvider<T>): void {
    provider.inject = provider.inject ?? [];
  }

  private shouldCache(provider: Provider): boolean {
    const scope = provider.scope ?? this.opts.defaultScope;
    return scope === 'singleton' || scope === 'scoped';
  }

  private maybeCache(token: Token, provider: Provider, value: unknown): void {
    if (!this.shouldCache(provider)) return;

    const lifetimeMs = provider.lifetimeMs;
    this.instances.set(token, {
      value,
      expiresAt: lifetimeMs && lifetimeMs > 0 ? Date.now() + lifetimeMs : undefined,
    });
  }

  private isExpired(record: InstanceRecord): boolean {
    return record.expiresAt !== undefined && Date.now() >= record.expiresAt;
  }

  private ensureAutoProvider<T>(token: Token<T>): void {
    if (this.providers.has(token)) return;

    const implementation = InjectableStore.getImplementation(token);
    if (implementation) {
      this.register({ token, useClass: implementation });
      return;
    }

    if (InjectableStore.has(token)) {
      this.register({ token, useClass: token as Constructor<T> });
    }
  }

  private emitResolveIfNeeded<T>(token: Token, instance: T): T {
    if (this.hooks.hasListeners) {
      this.hooks.emit({ type: 'resolve', token, instance });
    }
    return instance;
  }

  private emitCreateAndResolveIfNeeded<T>(token: Token, instance: T): void {
    if (!this.hooks.hasListeners) return;
    this.hooks.emit({ type: 'create', token, instance });
    this.hooks.emit({ type: 'resolve', token, instance });
  }

  private detectProviderKind<T>(provider: Omit<Provider<T>, 'kind'>): ProviderKind | undefined {
    if ('useClass' in provider) return 'class';
    if ('useFactory' in provider) return 'factory';
    if ('useValue' in provider) return 'value';
    if ('useExisting' in provider || 'useToken' in (provider as object)) return 'existing';
    return undefined;
  }

  private circularError(token: Token, stack: Set<Token>): CircularDependencyError {
    const chain = [...stack, token].map((item) => this.tokenToString(item)).join(' -> ');
    return new CircularDependencyError(`Circular dependency detected: ${chain}`);
  }

  private tokenToString(token: Token): string {
    return String((token as { name?: string })?.name ?? token);
  }
}