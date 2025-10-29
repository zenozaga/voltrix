export type Constructor<T = any> = new (...args: any[]) => T;
export type Token<T = any> = symbol | string | Constructor<T>;

export type Scope = 'singleton' | 'transient' | 'scoped';

export interface BaseProvider<T = unknown> {
  token: Token<T>;
  scope?: Scope;
  lifetimeMs?: number;
  timeoutMs?: number;
  inject?: Token[];
}

export interface ClassProvider<T = unknown> extends BaseProvider<T> {
  kind: 'class';
  useClass: Constructor<T>;
  useFactory?: never;
  useValue?: never;
  useExisting?: never;
}

export interface FactoryProvider<T = unknown> extends BaseProvider<T> {
  kind: 'factory';
  useFactory: (...deps: any[]) => T | Promise<T>;
  useClass?: never;
  useValue?: never;
  useExisting?: never;
}

export interface ValueProvider<T = unknown> extends BaseProvider<T> {
  kind: 'value';
  useValue: T;
  useClass?: never;
  useFactory?: never;
  useExisting?: never;
}

export interface ExistingProvider<T = unknown> extends BaseProvider<T> {
  kind: 'existing';
  useExisting: Token<T>;
  useClass?: never;
  useFactory?: never;
  useValue?: never;
}

export type Provider<T = unknown> =
  | ClassProvider<T>
  | FactoryProvider<T>
  | ValueProvider<T>
  | ExistingProvider<T>;

export type ProviderKind = Provider['kind'];
export type ProviderResolver<T = unknown> = (provider: Provider<T>, stack: Set<Token>) => (...args: any[]) => T | Promise<T>;

export type HookEvent =
  | { type: 'create'; token: Token; instance: unknown }
  | { type: 'resolve'; token: Token; instance: unknown }
  | { type: 'dispose'; token: Token; instance: unknown };

export interface ContainerOptions {
  autoInject?: boolean;
  defaultScope?: Scope;
  defaultTimeoutMs?: number;
}
