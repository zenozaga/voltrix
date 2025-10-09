import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    benchmark: {
      include: ['**/*.{bench,benchmark}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
      exclude: ['node_modules', 'dist', '.git']
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'dist/',
        'node_modules/',
        '**/*.config.*',
        '**/*.d.ts',
        'src/dev/**',
        '.tsbuildinfo'
      ],
      thresholds: {
        global: {
          branches: 70,
          functions: 70,
          lines: 70,
          statements: 70
        }
      }
    },
    testTimeout: 5000,
    setupFiles: [],
    include: ['tests/**/*.test.ts', 'benchmarks/**/*.test.ts'],
    exclude: ['dist/', 'node_modules/']
  },
});