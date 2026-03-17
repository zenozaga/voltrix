import { defineConfig } from 'vitest/config';

import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    benchmark: {
      include: ['**/*.bench.{ts,js}'],
    },
    alias: {
      '@voltrix/decorator': resolve(__dirname, '../packages/decorator/src/index.ts'),
      '@voltrix/express': resolve(__dirname, '../packages/express/src/index.ts'),
      '@voltrix/injector': resolve(__dirname, '../packages/injector/src/index.ts'),
      '@voltrix/core': resolve(__dirname, '../packages/core/src/index.ts'),
    }
  },
});
