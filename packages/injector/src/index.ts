import 'reflect-metadata';
import { DIContainer } from './container';

export * from './providers';
export * from './errors';
export * from './metadata';
export * from './decorators';
export * from './hooks';
export * from './utils/fast-timeout';
export * from './utils/fast-promise-cache';
export * from './utils/deps-resolver';
export * from './container';

export const container = DIContainer.create();
