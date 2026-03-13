# Voltrix MCP Development Guidelines

## 🎯 Architecture & Design Principles

### 1. Builder Pattern Implementation
**MANDATORIO**: Usar patrón Builder para configuración fluida y tipada

```typescript
// ✅ CORRECTO - Builder Pattern fluido
const mcpSystem = VoltrixMcp.builder()
  .server({ name: 'data-server', version: '2.0.0' })
  .withPlugin(ChatGPTPlugin({ ui: { theme: 'modern' } }))
  .withPlugin(AnalyticsPlugin({ trackPerformance: true }))
  .transport({ websocket: { port: 3001 }, http: { port: 3002 } })
  .security({ rateLimiting: { requests: 1000, window: '1h' } })
  .use(CompressionMiddleware())
  .build();

// ❌ INCORRECTO - Configuración directa sin validación
const { McpTool } = VoltrixMcp.create({ plugins: [...] });
```

### 2. Plugin Architecture Principles
- **Single Responsibility**: Cada plugin tiene una responsabilidad específica
- **Composable**: Plugins pueden combinarse sin conflictos
- **Extensible**: Nuevos plugins pueden extender funcionalidad existente
- **Typed**: Tipado automático según plugins instalados
- **Traceable**: Stack de transformaciones completo

### 3. Performance-First Design
- **Zero-Allocation Hot Paths**: Reutilizar objetos en paths críticos
- **Connection Pooling**: Gestión eficiente de conexiones
- **Lazy Loading**: Cargar recursos solo cuando se necesiten
- **Streaming Support**: Para transferencias de datos grandes
- **Sub-millisecond Response**: <1ms para operaciones de cache

## 📋 Mandatory Development Rules

### 🚨 CRITICAL REQUIREMENTS

#### 1. Plugin Validation & Compatibility
```typescript
// ✅ CORRECTO - Validación completa de plugins
class ChatGPTPlugin implements McpPlugin {
  validateConfig(config: ChatGPTConfig): ValidationResult {
    const errors = [];
    if (!config.cors?.origin) errors.push('CORS origin required');
    return { valid: errors.length === 0, errors };
  }
  
  isCompatibleWith(plugin: McpPlugin): boolean {
    return !plugin.id.startsWith('chatgpt') || plugin.id === this.id;
  }
  
  conflictsWith(plugin: McpPlugin): string[] {
    if (plugin.id.startsWith('chatgpt') && plugin.id !== this.id) {
      return [`Multiple ChatGPT plugins: ${this.id} vs ${plugin.id}`];
    }
    return [];
  }
}

// ❌ INCORRECTO - Sin validación
const plugin = { id: 'chatgpt', config: {} };
```

#### 2. Response Transformation Stack
```typescript
// ✅ CORRECTO - Trazabilidad completa
interface PluginOutput<T = any> {
  value: T;
  original: T;
  transformations: Array<{
    pluginId: string;
    pluginName: string;
    timestamp: Date;
    operation: string;
    metadata?: any;
    performance?: { duration: number; memoryUsed: number };
  }>;
  // Sección dinámica por plugin
  [pluginId: string]: any;
}

// ❌ INCORRECTO - Sin trazabilidad
const result = plugin.transform(data);
```
- Avoid `async/await` in critical performance paths if sync alternatives exist
- Use `Buffer` instead of string concatenation for binary data
- Prefer `for...of` and modern iteration patterns
- Cache frequently accessed properties and computations using memoization
- Use `Object.freeze()` for immutable configuration objects
- Profile memory usage and CPU time for all core components
- Implement lazy initialization patterns for expensive operations

### File and Directory Naming
- Use kebab-case for file names (e.g., `fast-router.ts`)
- Use PascalCase for class names and interfaces
- Use camelCase for variables and functions
- Group by feature, not by type (e.g., `/router/` not `/interfaces/`)

## Monorepo Architecture Rules

### Package Organization
- Each package must have a clear, single responsibility
- Core packages: `@voltrix/express`, `@voltrix/router`, `@voltrix/middleware`
- Utility packages: `@voltrix/websocket`, `@voltrix/plugins`
- Testing packages: `@voltrix/benchmarks`, `@voltrix/examples`
- Use workspace dependencies with `workspace:*` protocol in package.json

### Build System Standards
- Use `tsup` for all package compilation with ESM + CJS outputs
- Configure `vitest` for all testing with coverage reporting
- Maintain separate build configs per package when needed
- Use `pnpm` for dependency management and workspace linking
- Support both Node.js and browser environments where applicable

## uWebSockets.js Integration Rules

### Core Framework Patterns
- **NEVER block the event loop** - all I/O must be non-blocking
- Use uWebSockets.js native methods for maximum performance
- Implement Express-compatible API surface while maintaining uWS performance
- Support both HTTP and WebSocket on the same port seamlessly
- Handle backpressure properly for streaming responses
- Use uWS native compression when available

### Router Implementation
- Build radix tree for route matching optimization
- Cache compiled route patterns for reuse
- Support Express-style parameters (`:id`, `*`, etc.)
- Implement middleware chain optimization
- Avoid regex in hot paths - use string operations
- Pre-compile route handlers during startup

### Middleware System
- Implement Express-compatible middleware signature: `(req, res, next) => void`
- Support async middleware with proper error propagation
- Chain middleware efficiently without unnecessary function calls
- Allow middleware short-circuiting for performance
- Implement middleware error boundaries
- Support conditional middleware based on path/method

### Memory Management
- Pool request/response objects for reuse
- Implement buffer pooling for body parsing
- Clear references promptly to prevent memory leaks
- Use WeakMap for request-scoped data storage
- Monitor and limit memory growth in long-running processes

### Server Intercommunication
- Enable shared context when servers need to communicate
- Use proper message passing patterns between servers
- Implement proper error handling for cross-server communication
- Maintain isolation when intercommunication is not needed

## Documentation Requirements

### Code Documentation
- Use JSDoc comments for all public functions and classes
- Include parameter types and return value descriptions
- Document complex algorithms and business logic
- Maintain up-to-date README files

### API Documentation
- Document all public APIs using OpenAPI/Swagger
- Include request/response examples
- Specify error codes and their meanings
- Version API documentation with code changes

## Testing Standards - REAL HTTP ONLY

### 🚨 CRITICAL: NO MOCKS Policy
**Voltrix follows a strict REAL HTTP testing philosophy:**

```typescript
// ❌ FORBIDDEN - Never use mocks for HTTP testing
const mockRequest = vi.fn();
const mockResponse = { json: vi.fn(), status: vi.fn() };

// ✅ REQUIRED - Always use real HTTP servers and requests
const { app, appInstance } = await createApplication(TestApp);
const response = await fetch(`${baseURL}/users`);
const data = await response.json();
```

### Mandatory Testing Requirements with Vitest
- **ALL features MUST have comprehensive tests**
- Use real Express servers with actual ports (3333, 3334, etc.)
- Use fetch() for HTTP requests in integration tests
- Use createApplication() for Voltrix app instantiation
- Test direct controller methods for unit testing
- Performance tests MUST complete under 100ms
- Coverage reports with @vitest/coverage-v8
- Test names MUST describe business scenarios clearly

### Test Structure Requirements
```typescript
describe('🚀 Feature Name - REAL HTTP Tests', () => {
  let server: Server;
  const PORT = 3333;
  const BASE_URL = `http://localhost:${PORT}`;

  beforeAll(async () => {
    // Create REAL server with actual Express instance
    const { app } = await createApplication(TestApp);
    server = createRealExpressServer(app, PORT);
  });

  it('should handle real HTTP request with performance benchmark', async () => {
    const startTime = performance.now();
    const response = await fetch(`${BASE_URL}/endpoint`);
    const duration = performance.now() - startTime;
    
    expect(response.status).toBe(200);
    expect(duration).toBeLessThan(50); // Performance requirement
  });
});
```

### Integration Testing Excellence
- Test MCP protocol integration points with real protocols
- Validate middleware execution pipeline with real HTTP flow
- Test decorator functionality with actual metadata processing
- Test error scenarios with real server error responses
- Validate multi-server orchestration with actual network calls

## Error Handling

### Error Types
- Use custom error classes for domain-specific errors
- Include contextual information in error messages
- Log errors with appropriate severity levels
- Implement graceful degradation for non-critical failures

### Logging
- Use structured logging with consistent format
- Include correlation IDs for request tracking
- Log at appropriate levels (debug, info, warn, error)
- Avoid logging sensitive information

## 🚀 Performance Optimization - Latest Algorithms (2024-2025)

### Modern Algorithm Implementation
- **Radix Trees**: For ultra-fast route matching (O(log n) lookup)
- **Bloom Filters**: For efficient existence checks in large datasets
- **LRU Cache with Map**: Modern implementation using Map for O(1) operations
- **Boyer-Moore**: For fast string searching in request processing
- **Hash-based Routing**: Pre-computed hash maps for instant route resolution
- **Object Pooling**: Reuse patterns with modern WeakRef and FinalizationRegistry
- **Bitwise Operations**: For flag management and fast comparisons
- **Tail Call Optimization**: Recursive patterns optimized for V8 engine

### Memory Optimization Patterns
```typescript
// ✅ Modern object pooling with WeakRef
class ObjectPool<T> {
  private readonly pool = new Set<WeakRef<T>>();
  private readonly factory: () => T;
  
  acquire(): T {
    for (const ref of this.pool) {
      const obj = ref.deref();
      if (obj) {
        this.pool.delete(ref);
        return obj;
      }
    }
    return this.factory();
  }
  
  release(obj: T): void {
    this.pool.add(new WeakRef(obj));
  }
}

// ✅ Centralized type caching
const TYPE_CACHE = new Map<string, TypeDefinition>();
```

### CPU Optimization Techniques
- **Branch Prediction**: Structure conditionals for predictable paths
- **Loop Unrolling**: For critical performance loops
- **SIMD-style Operations**: Batch processing where applicable
- **Micro-optimizations**: Avoid function calls in hot paths
- **Inlining**: Use strategic function inlining for performance
- **Modern V8 Features**: Optimize for latest JavaScript engine improvements

## Voltrix Decorator Architecture Rules

### Centralized Type System Implementation
```typescript
// ✅ REQUIRED: All types in centralized location
// decorators/types/voltrix.types.ts
export interface VoltrixAppOptions {
  name: string;
  version: string;
  modules: any[];
  // ... ultra-optimized type definitions
}

// ✅ Import from centralized types
import type { VoltrixAppOptions } from './types/voltrix.types.js';
```

### Zero Duplication Factory Patterns
```typescript
// ✅ REQUIRED: Factory pattern for decorators
export function createRouteDecorator(method: string) {
  return (path: string = '/', options?: RouteOptions) => {
    // Ultra-optimized decorator implementation
    return DecoratorHelper({ /* optimized config */ });
  };
}

// ✅ Usage - unlimited custom decorators
const ApiV1 = createRouteDecorator('GET');
const CustomPost = createRouteDecorator('POST');
```

### Performance Requirements for Decorators
- Decorator application: <1ms for simple decorators
- Metadata processing: <10ms for complex applications
- Route registration: <5ms per route regardless of complexity
- Memory usage: <1MB overhead for 1000+ decorated methods

## 🤖 AI Agent Development Rules

### When Adding New Features
**MANDATORY checklist for AI agents:**

1. **📋 Pre-Development Analysis**
   ```bash
   # Always analyze existing patterns first
   grep -r "similar_pattern" packages/*/src/
   # Check for existing types that can be reused
   find packages/*/src/types/ -name "*.ts"
   ```

2. **🧪 Test-Driven Development**
   ```typescript
   // ✅ ALWAYS start with test file creation
   // tests/new-feature.optimized.test.ts
   describe('🚀 New Feature - REAL HTTP Tests', () => {
     // Real HTTP server setup
     // Performance benchmarks
     // Error handling tests
   });
   ```

3. **⚡ Performance Validation**
   ```typescript
   // ✅ ALWAYS include performance tests
   it('should execute under performance budget', async () => {
     const startTime = performance.now();
     await featureExecution();
     const duration = performance.now() - startTime;
     expect(duration).toBeLessThan(TARGET_MS);
   });
   ```

4. **🔄 Code Review Checklist**
   - [ ] Centralized types used/created
   - [ ] Zero code duplication verified
   - [ ] Real HTTP tests implemented
   - [ ] Performance benchmarks included
   - [ ] Factory patterns used where applicable
   - [ ] Memory optimization patterns applied
   - [ ] Latest algorithm implementations used

### Common Mistakes to Avoid
❌ **Never do these:**
- Using vi.fn() for HTTP request mocking
- Duplicating type definitions across files
- Creating decorators without factory patterns
- Implementing features without performance tests
- Using outdated algorithm implementations
- Ignoring memory optimization opportunities

✅ **Always do these:**
- Use createApplication() for real server testing
- Import types from centralized locations
- Implement factory patterns for extensibility
- Include performance benchmarks in tests
- Use modern algorithms and data structures
- Profile memory usage and optimize

### Error Prevention Patterns
```typescript
// ✅ Type-safe error handling
class VoltrixError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, any>
  ) {
    super(message);
    this.name = 'VoltrixError';
  }
}

// ✅ Performance monitoring
function withPerformanceTracking<T>(
  operation: () => T,
  operationName: string
): T {
  const start = performance.now();
  try {
    const result = operation();
    const duration = performance.now() - start;
    console.log(`⚡ ${operationName}: ${duration.toFixed(2)}ms`);
    return result;
  } catch (error) {
    throw new VoltrixError(
      `Performance tracking failed for ${operationName}`,
      'PERF_TRACKING_ERROR',
      { operationName, error }
    );
  }
}
```

### 🎯 Feature Implementation Protocol
**Follow this exact sequence for every new feature:**

1. **Analysis Phase**
   - Study existing codebase patterns
   - Identify reusable types and components
   - Check for similar implementations
   - Plan performance optimization strategy

2. **Design Phase**
   - Create centralized types first
   - Design factory patterns for extensibility
   - Plan test scenarios with real HTTP
   - Define performance benchmarks

3. **Implementation Phase**
   - Start with test file creation
   - Implement core functionality
   - Use centralized types and patterns
   - Apply modern algorithms

4. **Validation Phase**
   - Run all tests with real HTTP servers
   - Validate performance benchmarks
   - Check memory usage patterns
   - Verify zero code duplication

5. **Documentation Phase**
   - Update JSDoc comments
   - Add usage examples
   - Document performance characteristics
   - Update README if needed

### 🚨 CRITICAL SUCCESS METRICS
Every feature must meet these standards:
- ✅ 100% test coverage with real HTTP
- ✅ Performance within defined budgets
- ✅ Zero code duplication detected
- ✅ Centralized types used/created
- ✅ Modern algorithm implementations
- ✅ Memory optimization applied