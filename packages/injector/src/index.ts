import 'reflect-metadata';
import { DIContainer } from '.\/container.js';

export * from '.\/providers.js';
export * from '.\/errors.js';
export * from '.\/metadata.js';
export * from '.\/decorators.js';
export * from '.\/hooks.js';
export * from '.\/utils/fast-timeout.js';
export * from '.\/utils/fast-promise-cache.js';
export * from '.\/container.js';

export const container = DIContainer.create();
