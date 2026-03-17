# Framework Knowledge Base - Current State

## Implementation Status Overview

### ✅ IMPLEMENTED FEATURES

#### Core Architecture
- **Modular Architecture**: App → Module → Controller → Function ✅
- **Decorator System**: Full decorator support with metadata ✅
- **Type Safety**: Strict TypeScript with comprehensive types ✅
- **Performance**: Optimized metadata handling and caching ✅

#### Application Layer 
- `@VoltrixApp` - Application configuration and lifecycle ✅
- `@OnInit, @OnStart, @OnReady, @OnStop, @OnDestroy` - Lifecycle hooks ✅
- Factory functions: `createVoltrix`, `createVoltrixProduction` ✅
- Cluster support and environment-specific configurations ✅

#### Module Layer
- `@Module` - Feature module organization ✅
- `processModule` - Module processing and metadata extraction ✅
- Dependency injection container integration ✅
- Inter-module dependency management ✅

#### Controller Layer (RECENTLY IMPLEMENTED)
- `@Controller('prefix')` - Simple prefix controller ✅
- `@Controller({ prefix, middleware, roles, scopes, version })` - Advanced options ✅
- `processController` - Route extraction and path combination ✅
- Integration with security decorators ✅
- Metadata preservation and aggregation ✅

#### HTTP Method Decorators
- Standard methods: `@GET, @POST, @PUT, @DELETE, @PATCH, @OPTIONS, @HEAD` ✅
- Enhanced methods: `@CACHED_GET, @RATE_LIMITED_POST` ✅
- WebSocket support: `@WebSocket` ✅
- Route path combination with controller prefixes ✅

#### Security System  
- `@Roles(...)` - Multi-role access control ✅
- `@Scopes(...)` - Permission scopes ✅  
- `@Security, @RequireRoles, @RequireScopes` ✅
- `@Public, @Protected` - Access level modifiers ✅
- Integration with controllers and routes ✅

#### Middleware System
- `@Middleware` - Custom middleware attachment ✅
- Built-in middleware: `@CORS, @Compression, @SecurityHeaders, @DetailedLogging` ✅
- Middleware execution order (global → controller → method) ✅

#### Validation System
- `@Body, @Query, @Params, @Headers` - Parameter extraction ✅
- `@Req, @Res` - Request/Response injection ✅
- Multi-validator support: `@ZodValidator, @ClassValidator, @JSONSchemaValidator` ✅
- Type transformation and coercion ✅

#### File Handling
- `@FileStream` - File streaming operations ✅
- `@FilePDF` - PDF-specific handling ✅
- `@ImageUpload` - Image processing ✅
- Streaming and validation capabilities ✅

#### Dependency Injection
- `@Injectable` - Service registration ✅
- `@Inject, @Singleton, @Transient, @Request` - DI patterns ✅
- Optimized container (faster than tsyringe) ✅
- Hierarchical container support ✅

#### Custom Decorator System (NEWLY IMPLEMENTED)
- `createCustomRequestDecorator<T>()` - Factory for custom decorators ✅
- `getCustomDecoratorMetadata()` - Metadata retrieval ✅
- Pre-built decorators: `@Parser, @Cache, @RateLimit, @Transform` ✅
- Type-safe custom decorator creation ✅
- Method, class, and parameter decoration support ✅

#### Testing Infrastructure
- **Current Status: 141/141 tests passing** ✅
- Comprehensive test coverage (90%+ for all components) ✅
- Unit tests for all decorators ✅
- Integration tests for decorator combinations ✅
- Performance benchmarks ✅
- Documentation example tests ✅

### 🚧 PARTIALLY IMPLEMENTED / IN PROGRESS

#### Extensibility System
- `.extend()` pattern design completed 🔄
- Implementation for specific decorators pending 🔄
- Cross-decorator extension patterns 🔄

#### Framework Integration
- Express integration foundation ✅
- uWebSockets.js optimization preparation 🔄
- Framework-agnostic adapter pattern 🔄

### ⏳ PLANNED FEATURES

#### Advanced Patterns
- Plugin system for third-party decorators ⏳
- Schema generation (OpenAPI) ⏳
- Hot reloading for development ⏳
- Distributed tracing ⏳

#### Performance Enhancements
- Native compilation optimizations ⏳
- Advanced caching strategies ⏳
- Memory pool optimization ⏳

## Key Knowledge for AI Agents

### 1. Architecture Understanding
```typescript
// This is the established pattern
@VoltrixApp({ modules: [UserModule] })
class App {}

@Module({ controllers: [UserController] })  
class UserModule {}

@Controller('v1')                           // NEW: Controller grouping
class UserController {
  @GET('/users')                           // Function level
  @Roles('user')                          // Security integration
  @Parser({ schema: userSchema })         // NEW: Custom decorators
  async getUsers() {}
}
```

### 2. Custom Decorator Creation
```typescript
// This is how to create new decorators like @Parser
const NewDecorator = createCustomRequestDecorator<{
  option1?: string;
  option2?: boolean;
}>('decoratorName', {
  option1: 'default'  // Default options
});

// Usage
@NewDecorator({ option2: true })
async method() {}

// Retrieval  
const metadata = getCustomDecoratorMetadata('decoratorName', target, 'method');
```

### 3. Testing Patterns
```typescript
// Follow this pattern for all new tests
describe('@voltrix/decorator - NewFeature', () => {
  it('should have basic functionality', () => {
    // Test implementation
  });
  
  it('should integrate with existing decorators', () => {
    @Controller('test')
    class TestController {
      @NewDecorator()
      @GET('/test')
      async testMethod() {}
    }
    
    const result = processController(TestController);
    // Verify integration
  });
});
```

### 4. Metadata Handling
```typescript
// Always use Symbol-based keys
const METADATA_KEY = Symbol('voltrix:feature-name');

// Store metadata
Reflect.defineMetadata(METADATA_KEY, data, target, propertyKey);

// Retrieve metadata  
const metadata = Reflect.getMetadata(METADATA_KEY, target, propertyKey);
```

### 5. Performance Considerations
- Use lazy loading for metadata operations
- Cache reflection results where possible
- Prefer native JavaScript over libraries
- Use WeakMap for object associations
- Profile memory usage in decorator chains

### 6. Type Safety Requirements
- All new decorators must have comprehensive TypeScript types
- Use generics for customizable decorator options
- Validate types at both compile-time and runtime
- Follow strict TypeScript configuration

### 7. Integration Points
- **Security**: New decorators should integrate with `@Roles/@Scopes`
- **Controllers**: Route-level decorators should work with `@Controller`
- **Validation**: Parameter decorators should support validation
- **Middleware**: Should support middleware attachment patterns

## Code Generation Guidelines

### When Adding New Decorators:
1. Define interface in `src/types/index.ts`
2. Add Symbol to `METADATA_SYMBOLS`
3. Implement in appropriate `src/decorators/` file
4. Export in `src/index.ts`
5. Create test file in `tests/decorators/`
6. Add integration tests with existing decorators
7. Update documentation

### When Modifying Existing Decorators:
1. Ensure backward compatibility
2. Update all related tests
3. Verify integration with Controller system
4. Check performance impact
5. Update type definitions
6. Document breaking changes

### Performance Requirements:
- New decorators should add <1ms overhead
- Memory usage should be minimal and bounded
- Metadata operations should be cached when possible
- Hot paths should be optimized for speed

## Current Capabilities Summary

The framework currently supports:
✅ **Full modular architecture** (App/Module/Controller/Function)
✅ **Complete decorator ecosystem** (HTTP, Security, Validation, Files, Custom)
✅ **High-performance DI container**
✅ **Custom decorator factory system** (like @Parser)
✅ **Comprehensive testing** (141/141 tests passing)
✅ **Type-safe development experience**
✅ **Production-ready performance**

The system is ready for production use and extension development. New features should follow the established patterns and maintain the high performance and type safety standards.