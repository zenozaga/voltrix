# Testing Strategy for New Components

## Testing Requirements

### Test Coverage Standards
- **Minimum Coverage**: 90% line coverage for all new components
- **Current Status**: 141/141 tests passing
- **Test Structure**: Follow the established pattern in `tests/decorators/`

### Test Categories

#### 1. Decorator Unit Tests
```typescript
// Pattern: tests/decorators/{decorator-name}.test.ts
import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { YourDecorator, getMetadata } from '../../src/decorators/your-decorator';

describe('@voltrix/decorator - YourDecorator', () => {
  describe('Basic Functionality', () => {
    it('should be defined and callable', () => {
      expect(YourDecorator).toBeDefined();
      expect(typeof YourDecorator).toBe('function');
    });

    it('should apply metadata correctly', () => {
      class TestClass {
        @YourDecorator({ option: 'value' })
        testMethod() {}
      }

      const metadata = getMetadata('your-symbol', TestClass.prototype, 'testMethod');
      expect(metadata).toBeDefined();
      expect(metadata.option).toBe('value');
    });
  });

  describe('Integration Tests', () => {
    it('should work with other decorators', () => {
      // Test decorator combinations
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid parameters', () => {
      // Test error cases
    });
  });
});
```

#### 2. Controller Tests (NEW PATTERN)
```typescript
// For Controller-related functionality
describe('Controller Integration', () => {
  it('should process controller with new decorator', () => {
    @Controller('v1')
    class TestController {
      @YourDecorator({ option: 'test' })
      @GET('/endpoint')
      async testEndpoint() {}
    }

    const result = processController(TestController);
    expect(result.routes).toHaveLength(1);
    
    // Verify decorator metadata is preserved in route processing
    const route = result.routes[0];
    expect(route.path).toBe('/v1/endpoint');
    // Add specific assertions for your decorator's metadata
  });
});
```

#### 3. Custom Decorator Factory Tests (NEW PATTERN)
```typescript
// For custom decorator factories
describe('Custom Decorator Factory', () => {
  it('should create decorator factory correctly', () => {
    const CustomDecorator = createCustomRequestDecorator<{
      option1?: string;
      option2?: number;
    }>('customTest', {
      option1: 'default'
    });

    expect(CustomDecorator).toBeInstanceOf(Function);
  });

  it('should merge options correctly', () => {
    const factory = createCustomRequestDecorator('test', { default: true });
    const decorator = factory({ custom: 'value' });
    
    // Test that decorator works and merges options correctly
    expect(decorator).toBeInstanceOf(Function);
  });

  it('should store and retrieve metadata', () => {
    // Test metadata storage and retrieval
    // Follow pattern from tests/decorators/custom-decorators.test.ts
  });
});
```

### Testing Patterns to Follow

#### 1. Metadata Testing Pattern
```typescript
// Always test metadata storage and retrieval
const metadata = Reflect.getMetadata(SYMBOL_KEY, target, propertyKey);
expect(metadata).toBeDefined();
expect(metadata.expectedProperty).toBe('expectedValue');
```

#### 2. Decorator Combination Testing
```typescript
// Test decorators working together
@Controller('test')
class CombinedController {
  @YourDecorator()
  @Roles('admin')
  @GET('/combined')
  async combinedMethod() {}
}
```

#### 3. Error Case Testing
```typescript
// Always test error scenarios
it('should throw error for invalid configuration', () => {
  expect(() => {
    @YourDecorator({ invalid: 'config' })
    class BadClass {}
  }).toThrow();
});
```

### Test File Structure

```
tests/
├── common/
│   └── di-container.test.ts
├── decorators/
│   ├── application.test.ts
│   ├── controller.test.ts          # Controller decorator tests
│   ├── custom-decorators.test.ts   # Custom decorator factory tests  
│   ├── files.test.ts
│   ├── http.test.ts
│   ├── middleware.test.ts
│   ├── security.test.ts
│   ├── validation.test.ts
│   └── {new-decorator}.test.ts     # New decorator tests go here
└── integration/                    # Add integration tests here
    └── full-stack.test.ts
```

### Test Execution Commands

```bash
# Run all tests
pnpm vitest run

# Run specific test file
pnpm vitest run tests/decorators/your-decorator.test.ts

# Run tests in watch mode
pnpm test

# Run tests with coverage
pnpm vitest run --coverage
```

### Test Quality Standards

#### 1. Descriptive Test Names
- ✅ `should apply metadata correctly when given valid options`
- ❌ `test metadata`

#### 2. Comprehensive Scenarios
- Basic functionality tests
- Edge case handling
- Integration with existing decorators
- Error condition testing
- Performance considerations (for critical paths)

#### 3. Test Isolation
- Each test should be independent
- Use `describe` blocks to group related tests
- Clean up any global state between tests

#### 4. Mock Strategy
- Mock external dependencies
- Use real reflect-metadata for metadata tests
- Mock HTTP requests/responses when testing route handlers

### Performance Testing

For performance-critical decorators:

```typescript
describe('Performance Tests', () => {
  it('should execute within performance threshold', () => {
    const start = performance.now();
    
    // Execute decorator many times
    for (let i = 0; i < 10000; i++) {
      // Test decorator application
    }
    
    const end = performance.now();
    expect(end - start).toBeLessThan(100); // 100ms threshold
  });
});
```

### Integration with CI/CD

Tests must pass before merging:
- All existing tests continue to pass (141/141)
- New tests achieve 90%+ coverage  
- No performance regressions
- Type checking passes with strict mode

### Documentation Testing

Include executable examples in tests:

```typescript
describe('Documentation Examples', () => {
  it('should work like documented in README', () => {
    // Copy exact example from README/docs and test it works
  });
});
```

## Test Implementation Checklist

For each new component:

- [ ] Unit tests for core functionality
- [ ] Integration tests with existing decorators
- [ ] Error handling tests
- [ ] Performance tests (if performance-critical)
- [ ] Documentation example tests
- [ ] Controller integration tests (if applicable)
- [ ] Custom decorator factory tests (if applicable)
- [ ] Metadata storage/retrieval tests
- [ ] Type safety tests
- [ ] Edge case coverage

## Current Test Status

✅ **141/141 tests passing**
- Application decorators: 14 tests
- Controller decorators: 6 tests  
- Custom decorators: 10 tests
- Files decorators: 16 tests
- HTTP decorators: 17 tests
- Middleware decorators: 15 tests
- Security decorators: 30 tests
- Validation decorators: 21 tests
- DI container: 12 tests

New components should follow this established testing excellence standard.