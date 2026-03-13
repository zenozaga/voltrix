# Voltrix Framework Architecture Guide

## Overview

Voltrix is a high-performance, decorator-driven TypeScript framework designed for modular, scalable applications. The architecture follows a hierarchical pattern: **App → Module → Controller → Function**.

## Core Architecture Pattern

```
VoltrixApp (Application Level)
├── Module (Feature Level)
│   ├── Controller (Route Group Level)
│   │   ├── Function (Individual Endpoint)
│   │   ├── Function (Individual Endpoint)
│   │   └── Function (Individual Endpoint)
│   ├── Controller (Route Group Level)
│   └── Service (Business Logic)
├── Module (Feature Level)
└── Global Middleware/Configuration
```

## Decorator System Layers

### 1. Application Layer (`@VoltrixApp`)
```typescript
@VoltrixApp({
  port: 3000,
  modules: [UserModule, AdminModule],
  cors: { origin: '*' },
  middleware: [globalLogging, globalSecurity]
})
class MyApp {
  @OnStart()
  async onStart() {
    console.log('App started');
  }
}
```

**Responsibilities:**
- Global configuration
- Module registration
- Lifecycle management
- Global middleware
- Server startup/shutdown

### 2. Module Layer (`@Module`)
```typescript
@Module({
  controllers: [UserController, AdminController],
  providers: [UserService, AdminService],
  imports: [DatabaseModule, AuthModule],
  exports: [UserService]
})
class UserModule {}
```

**Responsibilities:**
- Feature grouping
- Dependency organization
- Controller registration
- Service provider configuration
- Inter-module dependencies

### 3. Controller Layer (`@Controller`) - NEW
```typescript
@Controller('v1')              // Simple prefix
@Controller({                  // Advanced configuration
  prefix: 'api/v2',
  middleware: ['auth', 'cors'],
  version: '2.0',
  roles: ['user', 'admin'],
  scopes: ['read', 'write']
})
class UserController {
  // Functions defined here
}
```

**Responsibilities:**
- Route grouping and prefixing
- Controller-level middleware
- Controller-level security
- Route metadata management
- Business logic organization

### 4. Function Layer (HTTP Methods)
```typescript
class UserController {
  @GET('/users')
  @Cache({ ttl: 300 })
  @Roles('user')
  async getUsers() {}

  @POST('/users')
  @Parser({ schema: userSchema, validate: true })
  @Scopes('user:create')
  async createUser(@Body() userData: CreateUserDto) {}
}
```

**Responsibilities:**
- Individual endpoint logic
- Request/response handling
- Method-level decorators
- Parameter validation
- Business operation execution

## Metadata System Architecture

### Metadata Symbols
```typescript
export const METADATA_SYMBOLS = {
  // Core symbols
  ROUTES: Symbol('voltrix:routes'),
  MODULES: Symbol('voltrix:modules'),
  CONTROLLER: Symbol('voltrix:controller'),    // NEW
  
  // Security symbols  
  ROLES: Symbol('voltrix:roles'),
  SCOPES: Symbol('voltrix:scopes'),
  
  // Validation symbols
  BODY: Symbol('voltrix:body'),
  QUERY: Symbol('voltrix:query'),
  PARAMS: Symbol('voltrix:params')
};
```

### Metadata Flow
1. **Decorator Application**: Metadata stored using `Reflect.defineMetadata`
2. **Processing Phase**: Metadata extracted during `processController` / `processModule`
3. **Route Generation**: Combined metadata creates final route configuration
4. **Runtime Access**: Framework accesses metadata for request handling

## Custom Decorator System

### Factory Pattern (NEW)
```typescript
// Create custom decorators
const Parser = createCustomRequestDecorator<{
  schema?: any;
  validate?: boolean;
  transform?: (data: any) => any;
}>('parser', {
  validate: true  // defaults
});

// Usage
@Parser({ 
  schema: userSchema,
  transform: (data) => ({ ...data, id: generateId() })
})
async createUser() {}
```

### Custom Decorator Architecture
```typescript
// 1. Factory creates decorator function
createCustomRequestDecorator(name, defaults) 
  → Returns decorator factory

// 2. Factory creates specific decorator  
decoratorFactory(options)
  → Returns actual decorator function

// 3. Decorator stores metadata
decorator(target, propertyKey, descriptor)
  → Stores combined options using Reflect.defineMetadata

// 4. Runtime retrieval
getCustomDecoratorMetadata(name, target, property)
  → Retrieves stored metadata
```

## Request Processing Pipeline

### 1. Route Registration Phase
```
Controller Processing:
  └── @Controller metadata extraction
  └── Method scanning for HTTP decorators  
  └── Route path combination (prefix + method path)
  └── Security metadata aggregation
  └── Custom decorator metadata preservation
```

### 2. Request Handling Phase
```
Incoming Request:
  ├── Route matching
  ├── Middleware execution (global → controller → method)
  ├── Security validation (roles, scopes)
  ├── Parameter extraction and validation
  ├── Custom decorator processing
  ├── Method execution
  └── Response transformation
```

## Dependency Injection Architecture

### Container Hierarchy
```
Application Container (Root)
├── Module Container (Feature-scoped)
│   ├── Controller Instance
│   ├── Service Instance  
│   └── Provider Instance
└── Request Container (Request-scoped)
    └── Request-specific instances
```

### DI Decorators
```typescript
@Injectable()                    // Service registration
@Inject('token')                // Explicit injection
@Singleton()                    // Singleton lifecycle
@Transient()                    // New instance per injection
@Request()                      // Request-scoped lifecycle
```

## Performance Architecture

### Metadata Caching
- **LRU Cache**: Frequently accessed metadata cached
- **Symbol-based Keys**: Avoid property name conflicts
- **Lazy Loading**: Metadata loaded only when needed
- **Memory Management**: WeakMap associations for GC

### Optimization Strategies
- **Reflection Minimization**: Cache reflection results
- **Hot Path Optimization**: Fast-path for common scenarios  
- **Object Pooling**: Reuse objects in hot paths
- **Native JavaScript**: Prefer native features over libraries

## Integration Architecture

### Express Integration (`@voltrix/express`)
```typescript
// Seamless framework integration
const voltrixApp = new VoltrixExpressApp(AppClass);
const expressApp = voltrixApp.getExpressApp();

// Route registration
voltrixApp.registerController(UserController);
voltrixApp.registerModule(UserModule);
```

### Framework Agnostic Core
- Core decorators work with any HTTP framework
- Framework-specific adapters handle integration
- Metadata format remains consistent across frameworks

## Error Handling Architecture

### Error Flow
```
Error Occurrence:
  ├── Decorator-level error handling
  ├── Controller-level error middleware  
  ├── Module-level error boundaries
  ├── Application-level error handlers
  └── Framework-level error responses
```

### Error Decorators
```typescript
@OnError()                      // Method-level error handler
@ErrorBoundary()               // Controller-level error boundary  
@GlobalErrorHandler()          // Application-level handler
```

## Security Architecture

### Multi-Level Security
```typescript
// Application-level
@VoltrixApp({ security: { cors: true, helmet: true } })

// Controller-level  
@Controller({ roles: ['user'], scopes: ['read'] })

// Method-level
@GET('/protected')
@Roles('admin')
@Scopes('sensitive:read')
```

### Security Flow
1. **Authentication**: Identity verification
2. **Authorization**: Role/scope checking  
3. **Rate Limiting**: Request throttling
4. **Input Validation**: Data sanitization
5. **Output Filtering**: Response sanitization

## Type System Architecture

### Generic Type Support
```typescript
// Controller with generic types
interface ControllerMetadata<T = any> {
  prefix?: string;
  middleware?: T[];
  version?: string;
  roles?: string[];
  scopes?: string[];
}

// Custom decorator with types
createCustomRequestDecorator<OptionsType>(name, defaults)
```

### Type Safety Features
- **Strict TypeScript**: All decorators fully typed
- **Generic Support**: Type-safe custom decorators  
- **Interface Validation**: Runtime type checking
- **Compilation Validation**: Build-time type checking

## Testing Architecture

### Test Structure
```
tests/
├── decorators/           # Unit tests per decorator
├── integration/         # Cross-decorator integration  
├── performance/         # Performance benchmarks
└── examples/           # Documentation tests
```

### Test Categories
- **Unit Tests**: Individual decorator functionality
- **Integration Tests**: Decorator combinations
- **Performance Tests**: Benchmark critical paths
- **Documentation Tests**: Executable examples

Current Status: **✅ 141/141 tests passing**

## Development Guidelines

### Adding New Decorators
1. Define metadata interface in `types/index.ts`
2. Add metadata symbol to `METADATA_SYMBOLS`  
3. Implement decorator in appropriate category file
4. Add to exports in `src/index.ts`
5. Create comprehensive tests following patterns
6. Update documentation with examples

### Architecture Principles
- **Composition over Inheritance**: Combine decorators rather than extend
- **Immutable Metadata**: Don't modify existing metadata
- **Lazy Evaluation**: Defer expensive operations
- **Memory Efficiency**: Use WeakMaps for object associations
- **Type Safety**: Maintain strict TypeScript compliance

## Future Architecture Considerations

### Planned Enhancements
- **Extensibility Pattern**: `.extend()` method for all decorators
- **Plugin System**: Third-party decorator integration
- **Schema Generation**: OpenAPI automatic generation
- **Hot Reloading**: Development-time decorator reloading
- **Distributed Tracing**: Request flow tracking

This architecture ensures scalability, maintainability, and performance while providing a developer-friendly experience with strong type safety and comprehensive testing.