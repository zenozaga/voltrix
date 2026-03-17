# Extensible Decorator Template

This template provides a standardized pattern for creating new extensible decorators in the @voltrix/decorator package.

## Base Template

```typescript
import { createExtensibleDecorator } from '../utils/extensible-decorator';
import { MetadataManager } from '../utils/metadata';
import { METADATA_SYMBOLS } from '../types';

// Define the base configuration interface
interface MyDecoratorConfig {
  // Base configuration properties
  enabled?: boolean;
  priority?: number;
}

// Define the extension interface
interface MyDecoratorExtension {
  // Extension-specific properties
  customProperty?: string;
  additionalOptions?: Record<string, any>;
}

// Create the decorator symbol for metadata
const MY_DECORATOR_SYMBOL = Symbol('my-decorator');

// Decorator factory function
function createMyDecorator(config: MyDecoratorConfig): MethodDecorator {
  return function (target: any, propertyKey: string | symbol | undefined, descriptor: PropertyDescriptor) {
    // Store metadata using the metadata manager
    MetadataManager.setMetadata(MY_DECORATOR_SYMBOL, config, target, propertyKey);
    
    // Implement decorator logic here
    const originalMethod = descriptor.value;
    
    descriptor.value = function (...args: any[]) {
      // Pre-execution logic
      if (config.enabled !== false) {
        console.log(`Executing ${String(propertyKey)} with config:`, config);
      }
      
      // Execute original method
      const result = originalMethod.apply(this, args);
      
      // Post-execution logic
      return result;
    };
    
    return descriptor;
  };
}

// Create the extensible decorator
export const MyDecorator = createExtensibleDecorator<MyDecoratorConfig, MyDecoratorExtension>(
  'MyDecorator',
  {
    enabled: true,
    priority: 0
  },
  createMyDecorator
);

// Create commonly used extensions
export const HighPriorityMyDecorator = MyDecorator.extend({
  priority: 10,
  customProperty: 'high-priority'
});

export const CustomMyDecorator = MyDecorator.extend({
  customProperty: 'custom-behavior',
  additionalOptions: {
    feature1: true,
    feature2: 'enabled'
  }
});
```

## Usage Example

```typescript
import { MyDecorator, HighPriorityMyDecorator, CustomMyDecorator } from './my-decorator';

class ExampleController {
  
  // Basic usage
  @MyDecorator()
  basicMethod() {
    return 'basic result';
  }
  
  // With configuration
  @MyDecorator({ priority: 5 })
  configuredMethod() {
    return 'configured result';
  }
  
  // Using pre-built extension
  @HighPriorityMyDecorator()
  priorityMethod() {
    return 'high priority result';
  }
  
  // Using custom extension
  @CustomMyDecorator()
  customMethod() {
    return 'custom result';
  }
  
  // Creating inline extension
  @MyDecorator.extend({ 
    customProperty: 'inline-extension',
    priority: 8 
  })()
  inlineExtensionMethod() {
    return 'inline extension result';
  }
}
```

## Testing Template

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { MyDecorator } from './my-decorator';
import { MetadataManager } from '../utils/metadata';

describe('MyDecorator', () => {
  let testInstance: any;
  
  beforeEach(() => {
    class TestClass {
      @MyDecorator({ priority: 5 })
      testMethod() {
        return 'test result';
      }
    }
    testInstance = new TestClass();
  });
  
  it('should apply decorator correctly', () => {
    const result = testInstance.testMethod();
    expect(result).toBe('test result');
  });
  
  it('should store metadata correctly', () => {
    const metadata = MetadataManager.getMetadata(
      Symbol.for('my-decorator'),
      testInstance.constructor.prototype,
      'testMethod'
    );
    
    expect(metadata).toEqual({
      enabled: true,
      priority: 5
    });
  });
  
  it('should support extension', () => {
    const ExtendedDecorator = MyDecorator.extend({
      customProperty: 'test-extension'
    });
    
    expect(typeof ExtendedDecorator).toBe('function');
    expect(typeof ExtendedDecorator.extend).toBe('function');
  });
  
  it('should cache extended decorators', () => {
    const extension = { customProperty: 'cache-test' };
    const extended1 = MyDecorator.extend(extension);
    const extended2 = MyDecorator.extend(extension);
    
    expect(extended1).toBe(extended2); // Same cached instance
  });
});
```

## Performance Considerations

### Optimization Checklist
- [ ] Metadata operations cached appropriately
- [ ] Extension instances cached to prevent recreation
- [ ] Decorator logic optimized for hot paths
- [ ] Memory usage profiled and optimized
- [ ] Type definitions maintain strict mode compliance

### Benchmarking Template
```typescript
import { benchmark } from '../utils/benchmark';

// Benchmark decorator application
benchmark('MyDecorator Application', () => {
  class TestClass {
    @MyDecorator()
    method() {}
  }
});

// Benchmark decorator extension
benchmark('MyDecorator Extension', () => {
  const ExtendedDecorator = MyDecorator.extend({
    customProperty: 'benchmark'
  });
});

// Benchmark method execution
benchmark('Decorated Method Execution', () => {
  const instance = new TestClass();
  instance.method();
});
```

## Integration Guidelines

### With Other Decorators
```typescript
class IntegratedController {
  
  // Combining with HTTP decorators
  @GET('/api/data')
  @MyDecorator({ priority: 1 })
  getData() {
    return { data: 'example' };
  }
  
  // Combining with validation
  @POST('/api/data')  
  @MyDecorator({ priority: 2 })
  @Body(DataSchema)
  createData(data: DataType) {
    return { created: data };
  }
  
  // Combining with security
  @GET('/admin/data')
  @Role(['admin'])
  @MyDecorator({ priority: 3 })
  getAdminData() {
    return { adminData: 'secret' };
  }
}
```

### Error Handling
```typescript
function createMyDecorator(config: MyDecoratorConfig): MethodDecorator {
  return function (target: any, propertyKey: string | symbol | undefined, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      try {
        // Pre-execution logic with error handling
        await validateConfig(config);
        
        const result = await originalMethod.apply(this, args);
        
        // Post-execution logic with error handling
        return result;
      } catch (error) {
        // Handle decorator-specific errors
        console.error(`MyDecorator error in ${String(propertyKey)}:`, error);
        throw error;
      }
    };
    
    return descriptor;
  };
}
```

## Documentation Template

### JSDoc Comments
```typescript
/**
 * MyDecorator - Brief description of decorator functionality
 * 
 * @example
 * ```typescript
 * class MyClass {
 *   @MyDecorator({ priority: 5 })
 *   myMethod() {
 *     return 'result';
 *   }
 * }
 * ```
 * 
 * @param config - Configuration object for the decorator
 * @param config.enabled - Whether the decorator is enabled (default: true)
 * @param config.priority - Execution priority (default: 0)
 * 
 * @returns Extended decorator with additional configuration options
 */
```

### README Section
```markdown
## MyDecorator

Brief description of what the decorator does and when to use it.

### Basic Usage
\`\`\`typescript
@MyDecorator()
methodName() {}
\`\`\`

### Configuration Options
- `enabled` (boolean): Enable/disable the decorator
- `priority` (number): Execution priority

### Extensions
\`\`\`typescript
const CustomDecorator = MyDecorator.extend({
  customProperty: 'value'
});
\`\`\`
```