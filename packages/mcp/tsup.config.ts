import { defineConfig } from 'tsup';

export default defineConfig([
  // Main bundle
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: true,
    minify: false,
    treeshake: true,
    splitting: true,
    outDir: 'dist',
    tsconfig: 'tsconfig.build.json',
    external: ['@voltrix/decorator'],
    esbuildOptions: (options) => {
      options.conditions = ['module', 'import'];
      options.mainFields = ['module', 'main'];
    },
  },
  // Types-only bundle
  {
    entry: ['src/types/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: false,
    minify: false,
    treeshake: true,
    outDir: 'dist/types',
    tsconfig: 'tsconfig.build.json',
    external: ['@voltrix/decorator'],
  },
  // Builder-only bundle
  {
    entry: ['src/builder/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    minify: false,
    treeshake: true,
    outDir: 'dist/builder',
    tsconfig: 'tsconfig.build.json',
    external: ['@voltrix/decorator'],
  },
  // Plugins-only bundle
  {
    entry: ['src/plugins/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    minify: false,
    treeshake: true,
    outDir: 'dist/plugins',
    tsconfig: 'tsconfig.build.json',
    external: ['@voltrix/decorator'],
  },
]);