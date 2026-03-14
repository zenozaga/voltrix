import 'reflect-metadata';
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
import { ProviderNotFoundError, CircularDependencyError, InvalidProviderError } from './errors';
import {
  META,
  getDesignParamTypes,
  getInjectedTokens,
  getInjectedProps,
  getMetadata,
  getInjectedOptional,
} from './metadata';
import { Hooks } from './hooks';
import { InjectableStore } from './utils/injectable-store';

type FactoryFn<T = any> = (...args: any[]) => T;
export const aSymbols = META;

type InstanceRecord = { value: unknown; expiresAt?: number };
const DISPOSERS = ['dispose', 'destroy', 'close'] as const;

type MiddlewareContext<T = any> = {
  token: Token<T>;
  provider?: Provider<T> | null;
  container: DIContainer;
  next: () => T;
};
type MiddlewareFn<T = any> = (ctx: MiddlewareContext<T>) => T;

/**
 * ⚡ Voltrix DIContainer — High-performance Dependency Injection Container
 * 
 */
export class DIContainer {
  private readonly providers = new Map<Token, Provider>();
  private readonly instances = new Map<Token, InstanceRecord>();
  private readonly hooks = new Hooks();
  private readonly middlewares: MiddlewareFn[] = []; // ✅ Middlewares síncronos
  private readonly opts: Required<ContainerOptions>;
  private readonly resolvers = {} as Record<ProviderKind, ProviderResolver>;
  private hasMiddleware = false;

  constructor(
    private readonly parent?: DIContainer,
    opts: ContainerOptions = {}
  ) {
    this.opts = {
      autoInject: opts.autoInject ?? true,
      defaultScope: opts.defaultScope ?? 'singleton',
      defaultTimeoutMs: opts.defaultTimeoutMs ?? 0,
    } as Required<ContainerOptions>;

    this.resolvers['class'] = this.instantiateClass.bind(this) as any;
    this.resolvers['factory'] = this.instantiateFactory.bind(this) as any;
    this.resolvers['value'] = this.instantiateValue.bind(this) as any;
    this.resolvers['existing'] = this.instantiateExisting.bind(this) as any;
  }

  private static _global?: DIContainer;

  static get global(): DIContainer {
    if (!this._global) this._global = new DIContainer();
    return this._global;
  }

  ////////////////////////////
  /// Creation & Hierarchy
  ////////////////////////////

  static create(opts?: ContainerOptions) {
    return new DIContainer(undefined, opts);
  }

  createChild(opts?: ContainerOptions): DIContainer {
    return new DIContainer(this, opts ?? this.opts);
  }

  ////////////////////////////
  /// Hooks
  ////////////////////////////

  on(
    handler: (ev: {
      type: 'create' | 'resolve' | 'dispose';
      token: Token;
      instance: unknown;
    }) => void
  ): () => void {
    return this.hooks.on(handler);
  }

  ////////////////////////////
  /// Middlewares
  ////////////////////////////

  use(fn: MiddlewareFn): void {
    this.middlewares.push(fn);
    this.hasMiddleware = true;
  }

  private runMiddlewares<T>(
    token: Token<T>,
    provider: Provider<T> | null,
    stack: Set<Token>,
    resolver: () => T
  ): T {
    let index = -1;

    const execute = (i: number): T => {
      if (i <= index) throw new Error('next() llamado más de una vez en middleware');
      index = i;
      const mw = this.middlewares[i];
      if (!mw) return resolver();
      const ctx: MiddlewareContext<T> = {
        token,
        provider,
        container: this,
        next: () => execute(i + 1),
      };
      return mw(ctx);
    };

    return execute(0);
  }

  ////////////////////////////
  /// Provider Registration
  ////////////////////////////

  register<T>(provider: Omit<Provider<T>, 'kind'>): void {
    const token = provider.token ?? provider.provide;
    if (!token) throw new InvalidProviderError('Provider must define a token or provide property');

    const kind =
      'useClass' in provider
        ? 'class'
        : 'useFactory' in provider
          ? 'factory'
          : 'useValue' in provider
            ? 'value'
            : ('useExisting' in provider || (provider as any).useToken)
              ? 'existing'
              : undefined;


    if (!kind)
      throw new InvalidProviderError(`Invalid provider configuration for ${String(token)}`);

    const _provider = { ...provider, kind, token } as Provider<T>;
    if (kind === 'existing') {
      (_provider as any).useExisting = (provider as any).useExisting ?? (provider as any).useToken;
    }


    const target = (provider as any).useClass as Constructor<T> | undefined;
    if (target) this.applyMetadata(target, _provider);

    this.providers.set(token, _provider);
  }

  registerMany(providers: (Constructor | AbstractConstructor)[]): void {
    for (const provider of providers) this.register({ token: provider, useClass: provider as any });
  }

  /**
   * Alias for resolve.
   */
  get<T>(token: Token<T>): T {
    return this.resolve(token);
  }

  has(token: Token): boolean {
    return this.providers.has(token) || !!this.parent?.has(token);
  }

  ////////////////////////////
  /// Resolution (con middleware síncrono)
  ////////////////////////////

  resolve<T>(token: Token<T>, stack?: Set<Token>): T {
    const cached = this.instances.get(token);
    if (cached) {
      if (cached.expiresAt === undefined || Date.now() < cached.expiresAt) {
        const val = cached.value as T;
        if (this.hooks.hasListeners) {
          this.hooks.emit({ type: 'resolve', token, instance: val });
        }
        return val;
      }
      this.instances.delete(token);
    }

    if (!stack) stack = new Set();

    if (!this.providers.has(token)) {
      const impl = InjectableStore.getImplementation(token);
      if (impl) {
        this.register({ token, useClass: impl });
      } else if (InjectableStore.has(token)) {
        this.register({ token, useClass: token as any });
      }
    }

    const provider = this.getProviderOrThrow(token, stack);
    if (!provider) return this.parent!.resolve(token, stack);

    if (stack.has(token)) throw this.circularError(token, stack);
    stack.add(token);

    try {
      // Fast path: skip middleware if not present
      if (!this.hasMiddleware) {
        const result = this.instantiate(provider, stack);
        this.maybeCache(token, provider, result);

        if (this.hooks.hasListeners) {
          this.hooks.emit({ type: 'create', token, instance: result });
          this.hooks.emit({ type: 'resolve', token, instance: result });
        }
        return result;
      }

      // Hot path: Middlewares wrap resolution
      return this.runMiddlewares(token, provider, stack, () => {
        const result = this.instantiate(provider, stack);
        this.maybeCache(token, provider, result);

        if (this.hooks.hasListeners) {
          this.hooks.emit({ type: 'create', token, instance: result });
          this.hooks.emit({ type: 'resolve', token, instance: result });
        }
        return result;
      });
    } finally {
      stack.delete(token);
    }
  }

  ////////////////////////////
  /// Instantiation
  ////////////////////////////

  private instantiate<T>(provider: Provider<T>, stack: Set<Token>): T {
    if (!this.resolvers[provider.kind])
      throw new InvalidProviderError(`Invalid provider for ${String(provider.token)}`);
    const hasFactory = !!(provider as any).factory;
    return (this.resolvers[provider.kind] as any)(provider, stack, hasFactory) as T;
  }

  private instantiateClass<T>(
    provider: Provider<T>,
    stack: Set<Token>,
    factoryReady: boolean = false
  ): T {
    const cls = (provider as any).useClass as Constructor<T>;

    if (!factoryReady) {
      const depsTokens = this.getDeps(provider, cls);
      (provider as any).deps = depsTokens;
      (provider as any).hasDeps = depsTokens.length > 0;
      (provider as any).factory = this.makeConstructorFactory(cls, depsTokens.length);
    }

    const factory = (provider as any).factory as FactoryFn<T>;
    const deps = (provider as any).deps as Token[] | undefined;

    const args: any[] = [];
    const len = deps?.length ?? 0;

    for (let i = 0; i < len; i++) {
      const token = deps![i];
      if (!token) {
        args.push(undefined);
        continue;
      }

      const optional = getInjectedOptional(cls, i) === true;

      try {
        args.push(this.resolve(token, stack));
      } catch (err) {
        if (optional) args.push(undefined);
        else throw err;
      }
    }

    const instance = factory(args);
    this.applyPropertyInjections(instance, cls, stack);
    return instance;
  }

  private instantiateFactory<T>(
    provider: Provider<T>,
    stack: Set<Token>,
    factoryReady: boolean = false
  ): T {
    const injects = provider.inject ?? [];

    if (!factoryReady) {
      (provider as any).deps = injects;
      (provider as any).hasDeps = injects.length > 0;
      (provider as any).factory = this.makeFactoryFunction(
        (provider as FactoryProvider<T>).useFactory!,
        injects.length
      );
    }

    const factory = (provider as any).factory as FactoryFn<T>;
    const deps = injects.length ? injects.map(t => this.resolve(t, stack)) : [];
    return factory(deps);
  }

  private instantiateValue<T>(provider: Provider<T>): T {
    return provider.useValue as T;
  }

  private instantiateExisting<T>(provider: Provider<T>, stack: Set<Token>): T {
    return this.resolve(provider.useExisting as Token<T>, stack);
  }

  ////////////////////////////
  /// Factory Builders
  ////////////////////////////

  private makeConstructorFactory<T>(Ctor: Constructor<T>, len: number): FactoryFn<T> {
    const map: Record<number, any> = {
      0: () => new Ctor(),
      1: (args: any[]) => new Ctor(args[0]),
      2: (args: any[]) => new Ctor(args[0], args[1]),
      3: (args: any[]) => new Ctor(args[0], args[1], args[2]),
      4: (args: any[]) => new Ctor(args[0], args[1], args[2], args[3]),
    };
    return map[len] ?? ((args: any[]) => new Ctor(...args));
  }

  private makeFactoryFunction<T>(fn: FactoryFn<T>, len: number): FactoryFn<T> {
    const map: Record<number, any> = {
      0: () => fn(),
      1: (args: any[]) => fn(args[0]),
      2: (args: any[]) => fn(args[0], args[1]),
      3: (args: any[]) => fn(args[0], args[1], args[2]),
      4: (args: any[]) => fn(args[0], args[1], args[2], args[3]),
    };
    return map[len] ?? ((args: any[]) => fn(...args));
  }

  ////////////////////////////
  /// Property Injection
  ////////////////////////////

  private applyMetadata<T>(target: Constructor<T>, provider: Provider<T>): void {
    const metaScope = getMetadata(META.SCOPE, target);
    if (metaScope && !provider.scope) provider.scope = metaScope as any;

    const metaLifetime = getMetadata(META.LIFETIME, target);
    if (metaLifetime && !provider.lifetimeMs) provider.lifetimeMs = metaLifetime as number;

    const metaTimeout = getMetadata(META.TIMEOUT, target);
    if (metaTimeout && !provider.timeoutMs) provider.timeoutMs = metaTimeout as number;
  }

  private applyPropertyInjections<T>(instance: T, cls: Constructor<T>, stack: Set<Token>) {
    const propMeta = getInjectedProps(cls) ?? [];

    for (const { key, token, optional } of propMeta) {
      try {
        (instance as any)[key] = this.resolve(token as any, stack);
      } catch (e) {
        if (!optional) throw e;
      }
    }

    if (this.opts.autoInject) {
      const proto = cls.prototype;
      const keys = Reflect.ownKeys(proto).filter(k => k !== 'constructor');
      for (const key of keys) {
        if (propMeta.some(m => m.key === key)) continue;
        const designType = Reflect.getMetadata('design:type', proto, key as any);
        if (designType && typeof designType === 'function' && this.has(designType)) {
          try {
            (instance as any)[key] = this.resolve(designType, stack);
          } catch { }
        }
      }
    }
  }

  private getDeps(provider: Provider, target: any): Token[] {
    if (provider.inject !== undefined) {
      return provider.inject;
    }

    if (this.opts.autoInject === true) {
      return getInjectedTokens(target) ?? getDesignParamTypes(target) ?? [];
    }

    return [];
  }

  ////////////////////////////
  /// Disposal & Cleanup
  ////////////////////////////

  dispose(token: Token): void {
    const rec = this.instances.get(token);
    if (!rec) return;
    this.instances.delete(token);
    const inst = rec.value as any;
    for (const m of DISPOSERS) {
      if (typeof inst?.[m] === 'function') {
        inst[m]();
        break;
      }
    }
    this.hooks.emit({ type: 'dispose', token, instance: inst });
  }

  clear(): void {
    for (const [token, rec] of this.instances.entries())
      this.hooks.emit({ type: 'dispose', token, instance: rec.value });
    this.instances.clear();
    this.providers.clear();
  }

  ////////////////////////////
  /// Utilities
  ////////////////////////////

  private shouldCache(provider: Provider<any>): boolean {
    const scope = provider.scope ?? this.opts.defaultScope;
    return scope === 'singleton' || scope === 'scoped';
  }

  private maybeCache(token: Token, provider: Provider, value: unknown) {
    if (!this.shouldCache(provider)) return;
    const lifetimeMs = provider.lifetimeMs;
    this.instances.set(token, {
      value,
      expiresAt: lifetimeMs ? Date.now() + lifetimeMs : undefined,
    });
  }

  private isExpired(rec: InstanceRecord): boolean {
    return rec.expiresAt !== undefined && Date.now() >= rec.expiresAt;
  }

  private getProviderOrThrow<T>(token: Token<T>, stack: Set<Token>): Provider<T> | null {
    const provider = this.providers.get(token);
    if (provider) return provider as Provider<T>;
    if (this.parent) return null;
    const name = String((token as any).name ?? token);
    throw new ProviderNotFoundError(`No provider found for ${name}`);
  }

  private circularError(token: Token, stack: Set<Token>) {
    const chain = [...stack, token].map(t => String((t as any).name ?? t)).join(' -> ');
    return new CircularDependencyError(`Circular dependency detected: ${chain}`);
  }

  private emitAndReturn<T>(token: Token, instance: T, created = false): T {
    if (created) this.hooks.emit({ type: 'create', token, instance });
    this.hooks.emit({ type: 'resolve', token, instance });
    return instance;
  }

  /**
   * Get all active instances in the container.
   */
  getInstances(): unknown[] {
    return Array.from(this.instances.values()).map(rec => rec.value);
  }

  /**
   * Alias for register (for compatibility).
   */
  addProvider<T>(provider: any): void {
    if (!provider) return;
    if (typeof provider === 'function') {
      this.register({ token: provider, useClass: provider });
    } else {
      this.register(provider);
    }
  }

  count(): number {
    return this.providers.size;
  }
}
