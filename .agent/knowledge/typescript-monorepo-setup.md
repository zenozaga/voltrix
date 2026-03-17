# TypeScript Monorepo Best Practices

## Monorepo Architecture with pnpm

### Workspace Configuration
```json
{
  "name": "@voltrix/monorepo",
  "private": true,
  "packageManager": "pnpm@8.0.0",
  "scripts": {
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "lint": "pnpm -r lint",
    "dev": "pnpm -r --parallel dev"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0",
    "tsup": "^8.0.0",
    "vitest": "^1.0.0"
  }
}
```

### pnpm-workspace.yaml
```yaml
packages:
  - 'packages/*'
  - 'apps/*'
  - 'tools/*'
```

## Package Structure Best Practices

### Core Package Layout
```
packages/
├── express/           # @voltrix/express
│   ├── src/
│   │   ├── index.ts
│   │   ├── app.ts
│   │   ├── router.ts
│   │   └── types.ts
│   ├── tests/
│   ├── package.json
│   └── tsup.config.ts
├── router/           # @voltrix/router
└── middleware/       # @voltrix/middleware
```

### TypeScript Configuration Strategy

#### Root tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "node",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitOverride": true,
    "composite": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "importHelpers": true,
    "skipLibCheck": true
  },
  "references": [
    { "path": "./packages/express" },
    { "path": "./packages/router" },
    { "path": "./packages/middleware" }
  ]
}
```

#### Package-specific tsconfig.json
```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "composite": true
  },
  "include": ["src/**/*"],
  "references": [
    { "path": "../router" }
  ]
}
```

## Build System with tsup

### Optimized tsup Configuration
```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  minify: false, // Keep readable for debugging
  target: 'es2022',
  splitting: false,
  bundle: true,
  external: ['uWebSockets.js'],
  treeshake: true,
  platform: 'node'
});
```

### Performance-Focused Build Options
- **Tree shaking enabled** for smaller bundle sizes
- **ESM + CJS outputs** for maximum compatibility  
- **Source maps** for debugging without performance impact
- **External dependencies** to avoid bundling large libraries
- **Target ES2022** for modern runtime optimization

## Testing Strategy with Vitest

### Vitest Configuration
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    }
  }
});
```

### Test Organization
- **Unit tests** for individual functions and classes
- **Integration tests** for package interactions
- **Performance tests** for benchmarking critical paths
- **E2E tests** for complete framework functionality

## Inter-Package Dependencies

### Workspace Dependencies
```json
{
  "dependencies": {
    "@voltrix/router": "workspace:*",
    "@voltrix/middleware": "workspace:*"
  }
}
```

### Dependency Guidelines
1. **Core packages** should have minimal external dependencies
2. **Utility packages** can depend on core packages
3. **Avoid circular dependencies** between packages
4. **Version alignment** across the monorepo
5. **Shared dev dependencies** in root package.json

## Development Workflow

### Scripts Organization
```json
{
  "scripts": {
    "build": "tsup",
    "build:watch": "tsup --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:ui": "vitest --ui",
    "lint": "eslint src/**/*.ts",
    "type-check": "tsc --noEmit",
    "dev": "tsx watch src/index.ts"
  }
}
```

### Development Commands
```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Test all packages
pnpm test

# Development mode with watch
pnpm dev

# Lint all packages
pnpm lint
```

## Performance Considerations

### Compilation Speed
- **Project references** for incremental compilation
- **Composite builds** for faster TypeScript compilation
- **Parallel execution** with pnpm for independent packages
- **Watch mode optimization** for development efficiency

### Bundle Optimization  
- **Tree shaking** to eliminate unused code
- **Bundle splitting** for optimal loading
- **External dependencies** to avoid duplication
- **Minification** for production builds only

### Development Experience
- **Hot reload** with tsx/ts-node for development
- **Type checking** in separate process for speed
- **Parallel testing** across packages
- **Incremental builds** with TypeScript project references

## Quality Assurance

### Linting Strategy
```json
{
  "extends": [
    "@typescript-eslint/recommended",
    "@typescript-eslint/recommended-requiring-type-checking"
  ],
  "rules": {
    "prefer-const": "error",
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/explicit-function-return-type": "warn"
  }
}
```

### Code Quality Tools
- **ESLint** with TypeScript rules for code quality
- **Prettier** for consistent formatting  
- **Husky** for git hooks and pre-commit checks
- **Lint-staged** for efficient pre-commit linting
- **Commitizen** for consistent commit messages