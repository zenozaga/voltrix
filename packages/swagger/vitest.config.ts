import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@voltrix/core': resolve(__dirname, '../core/src/index.ts'),
      '@voltrix/express': resolve(__dirname, '../express/src/index.ts'),
      '@voltrix/decorator': resolve(__dirname, '../decorator/src/voltrix.index.ts'),
      '@voltrix/injector': resolve(__dirname, '../injector/src/index.ts')
    }
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.ts']
  }
});
