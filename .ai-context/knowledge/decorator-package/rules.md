# @voltrix/decorator Package Rules and Conventions

## Decorator System Architecture

### Core Design Principles
- **Modular Architecture** - Support App → Module → Controller → Function pattern
- **Performance Optimized** - Zero overhead in hot paths, lazy initialization  
- **Type Safety** - Strict TypeScript with comprehensive type definitions
- **Framework Agnostic** - Core decorators work with any HTTP framework
- **Metadata Driven** - Use reflect-metadata for all decorator information storage
- **Custom Decorator Support** - Factory functions for creating custom decorators like `@Parser`
- **Extensibility First** - Every decorator must support extension patterns where applicable

### Controller Decorator Pattern
```typescript
// Controller decorator for modular architecture (IMPLEMENTED)
@Controller('v1') // String prefix
class UserController {}

@Controller({      // Options object
  prefix: 'api/v2',
  middleware: ['auth', 'cors'],
  version: '2.0',
  scopes: ['read', 'write'],
  roles: ['user', 'admin']
})
class AdminController {}

// Process controllers to extract routes and metadata
const result = processController(UserController);
// result.metadata.prefix = 'v1'
// result.routes = [...] // Routes with combined paths
// result.controllerClass = UserController
```

### Custom Decorator Factory Pattern (IMPLEMENTED)
```typescript
// Create custom decorators like @Parser
const Parser = createCustomRequestDecorator<{
  schema?: any;
  validate?: boolean;
  transform?: (data: any) => any;
  errorHandler?: (error: Error) => void;
}>('parser', {
  validate: true // default options
});

// Usage (like your original @Parser)
@Parser({ 
  schema: userSchema,
  validate: true,
  transform: (data) => processData(data)
})
async createUser() {}

// Retrieve custom decorator metadata
const metadata = getCustomDecoratorMetadata('parser', target, 'methodName');
```

### Extensibility Pattern Rules
```typescript
// Standard pattern for extensible decorators (FUTURE)
const BaseDecorator = createExtensibleDecorator({...});
const ExtendedDecorator = BaseDecorator.extend({ additional: 'options' });

// Example implementations:
const FilePDF = FileStream.extend({ type: ['application/pdf'] });
const AdminRole = Role.extend({ hierarchy: ['admin', 'moderator'] });
const AuthenticatedGet = GET.extend({ middleware: [authMiddleware] });
```

### Metadata Management Rules
- Use Symbol-based keys for all metadata to avoid conflicts
- Cache metadata operations with LRU eviction policy
- Lazy load reflection data only when needed
- Group related metadata under namespace symbols
- Validate metadata integrity during decorator application

## Decorator Categories Standards

### Application Architecture Decorators (IMPLEMENTED)
- **@VoltrixApp** - Application-level configuration and lifecycle
- **@Module** - Feature module grouping with controllers and providers  
- **@Controller** - Route grouping with prefix and metadata (NEW)
- **@Injectable** - Dependency injection registration
- Lifecycle hooks: @OnInit, @OnStart, @OnReady, @OnStop, @OnDestroy

### HTTP Method Decorators (IMPLEMENTED) 
- **Standard Methods**: @GET, @POST, @PUT, @DELETE, @PATCH, @OPTIONS, @HEAD
- **Enhanced Methods**: @CACHED_GET, @RATE_LIMITED_POST
- **WebSocket Support**: @WebSocket decorator
- Allow path parameters with Express-style syntax: `/users/:id`
- Support query parameter validation and transformation
- Enable middleware attachment per route
- Integration with Controller prefix for full route generation

### Security Decorators (IMPLEMENTED)
- **@Roles** - Role-based access control with multiple roles support
- **@Scopes** - Scope-based permissions with inheritance
- **@Security** - General security configuration
- **@RequireRoles / @RequireScopes** - Explicit requirement decorators
- **@Public / @Protected** - Access level modifiers
- Validate permissions at method and class levels
- Integrate with Controller decorator for route-level security
- Support hierarchical role-based access control (RBAC)

### Middleware Decorators (IMPLEMENTED)
- **@Middleware** - General middleware attachment
- **@CORS** - Cross-Origin Resource Sharing configuration
- **@Compression** - Response compression
- **@SecurityHeaders** - Security header injection
- **@DetailedLogging** - Enhanced logging middleware
- Execute middleware in predictable order (class → method → parameter)
- Support both sync and async middleware functions
- Allow middleware composition and chaining

### Validation Decorators (IMPLEMENTED)
- **@Body** - Request body validation and parsing
- **@Query** - Query parameter validation
- **@Params** - Route parameter validation  
- **@Headers** - Header validation
- **@Req / @Res** - Request/Response object injection
- **Multi-Validator Support**: @ZodValidator, @ClassValidator, @JSONSchemaValidator
- Automatic type transformation and coercion
- Custom validation functions and error messages
- Integration with Controller routes

### File Handling Decorators (IMPLEMENTED)
- **@FileStream** - File streaming operations
- **@FilePDF** - PDF-specific file handling
- **@ImageUpload** - Image upload processing
- Support streaming capabilities for large files
- File validation (size, type, content scanning)
- Multiple storage backend support preparation

### Custom Decorator Support (NEW - IMPLEMENTED)
- **createCustomRequestDecorator** - Factory for custom decorators
- **getCustomDecoratorMetadata** - Metadata retrieval helper
- **Pre-built Custom Decorators**:
  - **@Parser** - Data parsing and validation (like your original)
  - **@Cache** - Response caching configuration  
  - **@RateLimit** - Rate limiting settings
  - **@Transform** - Response transformation
- Support for method, class, and parameter decoration patterns
- Type-safe custom decorator creation with generics

## Performance Requirements

### Memory Management
- Use object pooling for frequently created instances
- Implement metadata caching with memory limits
- Avoid memory leaks in decorator application
- Use WeakMap for object associations where appropriate
- Profile memory usage in decorator chains

### Execution Speed
- Minimize reflection calls in hot paths
- Cache compiled validation functions
- Use native JavaScript features over libraries where possible
- Implement fast-path optimization for common scenarios
- Benchmark decorator overhead against plain functions

### Scalability Considerations
- Support horizontal scaling with stateless design
- Enable distributed caching for metadata
- Provide cluster-safe dependency injection
- Support graceful degradation under load
- Implement circuit breaker patterns for external dependencies

## Integration Standards

### @voltrix/express Integration
- Seamless integration with Voltrix request/response objects
- Support for uWebSockets.js performance optimizations
- Compatible with Express-style middleware patterns
- Enable framework-specific optimizations while maintaining compatibility

### Dependency Injection Rules
- Container must be optimized for performance over tsyringe
- Support singleton, transient, and request-scoped instances
- Implement circular dependency detection and resolution
- Provide decorator-based registration (@Injectable, @Inject)
- Support factory patterns and async initialization
- Enable hierarchical container inheritance

### Testing and Quality Assurance
- All decorators must have comprehensive unit tests
- Performance benchmarks required for critical paths
- Integration tests with @voltrix/express
- Documentation examples must be executable
- Type safety validated with strict TypeScript settings