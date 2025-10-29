import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts'
  },
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  minify: false,
  splitting: false,
  treeshake: true,
  target: 'es2022',
  tsconfig: './tsconfig.build.json',
  external: [
    '@voltrix/express'
  ],
  esbuildOptions(options) {
    options.keepNames = true;
    options.treeShaking = true;
  },
  onSuccess: 'echo "✅ @voltrix/decorator build successful"'
});