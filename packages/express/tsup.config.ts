import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'es2022',
  platform: 'node',
  external: ['uWebSockets.js'],
  treeshake: true,
  splitting: false,
  bundle: true,
  minify: false, // Keep readable for debugging in development
  keepNames: true,
  tsconfig: './tsconfig.build.json',
  outExtension({ format }) {
    return {
      js: format === 'cjs' ? '.js' : '.mjs',
    };
  },
});