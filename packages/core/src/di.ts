
export type AbstractConstructor<T = any> = abstract new (...args: any[]) => T;
export type Constructor<T = any> = new (...args: any[]) => T;
export type Token<T = any> = symbol | string | Constructor<T> | AbstractConstructor<T>;

export type ProviderScope = 'singleton' | 'transient' | 'scoped';

export interface BaseProvider<T = unknown> {
  token?: Token<T>;
  provide?: Token<T>;
  useClass?: Constructor<T>;
  useFactory?: (...deps: any[]) => T | Promise<T>;
  useValue?: T;
  useExisting?: Token<T>;
  useToken?: Token<T>;
  scope?: ProviderScope;
  lifetimeMs?: number;
  timeoutMs?: number;
  inject?: Token[];
}

export interface ClassProvider<T = unknown> extends BaseProvider<T> {
  kind: 'class';
  useClass: Constructor<T>;
}

export interface FactoryProvider<T = unknown> extends BaseProvider<T> {
  kind: 'factory';
  useFactory: (...deps: any[]) => T | Promise<T>;
}

export interface ValueProvider<T = unknown> extends BaseProvider<T> {
  kind: 'value';
  useValue: T;
}

export interface ExistingProvider<T = unknown> extends BaseProvider<T> {
  kind: 'existing';
}

export type Provider<T = unknown> =
  | ClassProvider<T>
  | FactoryProvider<T>
  | ValueProvider<T>
  | ExistingProvider<T>;
