import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],

    include: ['tests/**/*.test.ts'],
    exclude: ['node_modules', 'dist', '**/*.d.ts'],

    benchmark: {
      include: ['tests/**/*.bench.ts'],
    },
  },

  optimizeDeps: {
    include: ['reflect-metadata'],
  },

});
