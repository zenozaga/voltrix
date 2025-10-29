# Voltrix Framework - Package Context Overview

## Package-Specific Contexts and Tasks

### 📦 @voltrix/express (Core Framework)

**Status:** Initial Setup  
**Context Location:** `./packages/express/.ai-context/`

#### Current Implementation Tasks
1. **Core Application Class** (High Priority)
   - Express method chaining: `app.get().post().listen()`
   - HTTP method handlers: GET, POST, PUT, DELETE, PATCH, OPTIONS
   - Middleware registration: `app.use(middleware)`
   - Server listening: `app.listen(port, callback)`
   - Integration with uWebSockets.js App instance

2. **Request Wrapper Class** (High Priority)
   - Express-compatible properties: `method`, `url`, `headers`, `query`, `params`
   - Header access methods: `req.get()`, `req.header()`
   - Query parameter parsing from URL
   - Route parameter extraction
   - Body parsing preparation (stream-based)

3. **Response Wrapper Class** (High Priority)
   - Express response methods: `res.json()`, `res.send()`, `res.status()`
   - Header manipulation: `res.set()`, `res.get()`, `res.append()`
   - Streaming support: `res.pipe()`, chunked responses
   - Error handling and status codes

#### Performance Rules (Express Package)
- **ZERO allocations in hot paths** - Reuse objects, avoid `new` in request handlers
- **Express API compatibility** - Maintain familiar Express patterns and method signatures
- **uWS Integration Safety** - NEVER access uWS response after end(), handle onAborted()
- **Memory Management** - Pool Request/Response objects, implement proper cleanup

---

### 🎯 @voltrix/decorator (Decorator System)

**Status:** Active Development  
**Context Location:** `./packages/decorator/.ai-context/`

#### Architecture Pattern
**App → Module → Controller → Function** hierarchy

#### Decorator Categories & Implementation Status
1. **HTTP Methods** - `@GET`, `@POST`, `@PUT`, `@DELETE`, `@PATCH`, `@OPTIONS`
2. **Security** - `@Role`, `@Scope`, `@Permission`, `@Auth`, `@RateLimit`
3. **Middleware** - `@Middleware`, `@CORS`, `@Logger`, `@Compression`
4. **Validation** - `@Body`, `@Query`, `@Params`, `@Header`, `@Cookie`
5. **File Handling** - `@FileStream`, `@Upload`, `@Download`
6. **Application** - `@VoltrixApp`, `@Controller`, `@Service`
7. **Dependency Injection** - `@Injectable`, `@Inject`, `@Singleton`

#### Current Implementation Tasks
1. **Extensible Decorator System** (High Priority)
   - Base decorator class with `.extend()` method
   - Custom decorator factory functions
   - Metadata caching and optimization
   - Type-safe reflection system

2. **Dependency Injection Container** (High Priority)
   - High-performance DI container
   - Singleton pattern support
   - Lazy initialization
   - Memory-efficient instance management

3. **Controller Architecture** (High Priority)
   - `@Controller` decorator with modular routing
   - Route metadata extraction
   - Middleware integration
   - Parameter binding system

#### Framework Architecture Knowledge
```typescript
// Application Level
@VoltrixApp({
  port: 3000,
  modules: [UserModule, AdminModule],
  cors: { origin: '*' },
  middleware: [globalLogging, globalSecurity]
})
class MyApp {}

// Module Level  
@Module({
  controllers: [UserController],
  services: [UserService],
  middleware: [authMiddleware]
})
class UserModule {}

// Controller Level
@Controller('users')
class UserController {
  @GET(':id')
  @Auth('user')
  async getUser(@Params('id') id: string) {}
}
```

#### Performance Optimizations (Decorator Package)
- **Metadata caching** with LRU eviction
- **Lazy decorator initialization** for memory efficiency
- **Optimized reflection** with symbol keys
- **Pre-compiled validation functions**
- **Singleton pattern** for container instances

---

### 🔧 Development Tools & Utilities

#### @voltrix/tools (Operational)
**Location:** `./tools/`

Available utilities:
- `pnpm clean` - Basic cleanup (dist, cache, logs)
- `pnpm clean:dist` - Build artifacts only
- `pnpm clean:node-modules` - Dependencies only  
- `pnpm clean:all` - Complete cleanup
- `pnpm reset` - Full project reset
- `pnpm analyze` - Project structure analysis
- `pnpm deps:check` - Dependency audit
- `pnpm size:report` - Size analysis and optimization suggestions

#### @voltrix/benchs (Maintenance)
**Location:** `./benchmarks/`

Performance testing utilities:
- Framework comparison benchmarks
- Memory usage profiling
- Load testing scenarios
- Performance regression detection

---

### 🎯 Cross-Package Integration Points

#### Express ↔ Decorator Integration
- **Route Registration** - Decorators generate routes for Express app
- **Middleware Pipeline** - Decorator middleware integrates with Express middleware
- **Request/Response Enhancement** - Decorators add functionality to Express req/res
- **Error Handling** - Unified error handling across both systems

#### Performance Considerations
- **Zero-overhead abstractions** - Decorators compile to minimal runtime code
- **Memory pooling** - Shared object pools between Express and Decorator systems
- **Metadata optimization** - Efficient storage and retrieval of decorator metadata
- **Hot path optimization** - Critical paths avoid decorator overhead

---

### 📋 Global Development Rules

#### Code Quality Standards
- **TypeScript Strict Mode** - All packages use strict type checking
- **Performance First** - Benchmark every change, measure impact
- **Express Compatibility** - Maintain familiar APIs where applicable
- **Modular Architecture** - Clear separation of concerns between packages
- **Test Coverage** - Comprehensive testing for all core functionality

#### Package Dependencies
- **@voltrix/decorator** depends on **@voltrix/express**
- **@voltrix/benchs** uses both core packages for testing
- **@voltrix/tools** provides utilities for all packages
- **Minimal external dependencies** - Prefer native solutions where possible

#### Documentation Standards
- **Package-level README** - Clear usage examples and API documentation
- **AI Context Files** - Maintain up-to-date context for development assistance
- **Task Documentation** - Detailed implementation guides in .ai-context/tasks/
- **Architecture Guides** - Framework knowledge in .ai-context/knowledge/