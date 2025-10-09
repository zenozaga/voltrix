import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'dist/',
        'node_modules/',
        '**/*.config.*',
        '**/*.d.ts',
        'coverage/',
        '.tsbuildinfo'
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    },
    testTimeout: 10000,
    hookTimeout: 10000,
    setupFiles: []
  },
  resolve: {
    alias: {
      '@': './src'
    }
  }
});