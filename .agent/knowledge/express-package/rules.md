# @voltrix/express Package Rules

## Perf#### WebSocket Rules
- **Router WebSocket Support** - Routers now support `router.ws()` for modular WebSocket handling  
- **Automatic Mounting** - WebSocket routes are automatically mounted when using `app.use()` with routers
- **Path Combination** - WebSocket paths are combined correctly when mounting routers with base paths
- **Handler Chaining** - All WebSocket handlers (upgrade, open, message, close) are properly forwarded

#### Code Organization Rules

#### File Structure
```
src/
├── index.ts          # Main exports
├── app.ts            # Core Application class-First Development Rules

### Core Principles
- **ZERO allocations in hot paths** - Reuse objects, avoid `new` in request handlers
- **Express API compatibility** - Maintain familiar Express patterns and method signatures
- **Benchmark every change** - Measure performance impact of all modifications
- **Memory efficiency** - Pool objects, clear references, monitor heap growth
- **Type safety** - Strict TypeScript with comprehensive type definitions

### uWebSockets.js Integration Rules

#### Request/Response Handling
- **NEVER access uWS response after end()** - Will cause segmentation fault
- **Always handle onAborted()** for async operations to prevent crashes
- **Copy request data immediately** - uWS request data is ephemeral
- **Use res.cork() for multiple writes** - Batch operations for performance
- **Implement proper backpressure handling** for streaming responses

#### Memory Management
- **Pool Request/Response objects** for reuse across requests
- **Clear request-scoped data promptly** to prevent memory leaks
- **Use WeakMap for request-scoped storage** instead of object properties
- **Monitor heap growth patterns** during load testing
- **Implement object lifecycle management** with proper cleanup

### Express Compatibility Rules

#### API Surface Compatibility
- **Maintain Express method signatures** - `app.get()`, `app.post()`, etc.
- **Support Express middleware patterns** - `(req, res, next) => void`
- **Implement Express request/response properties** - `req.params`, `res.json()`, etc.
- **Handle Express routing patterns** - `:id`, `*`, regular expressions
- **Support Express error handling** - 4-parameter error middleware

#### Middleware System
- **Execute middleware in registration order** - Predictable execution sequence
- **Support middleware path matching** - Route-specific middleware
- **Handle async middleware properly** - Await async functions, catch errors
- **Implement middleware error boundaries** - Prevent one middleware from breaking others
- **Optimize middleware chain execution** - Minimal function call overhead

### Code Organization Rules

#### File Structure
```
src/
├── index.ts          # Main exports
├── app.ts            # Core Application class
├── request.ts        # Request wrapper class
├── response.ts       # Response wrapper class
├── router.ts         # Routing engine
├── middleware.ts     # Middleware system
├── types.ts          # TypeScript type definitions
└── utils/            # Utility functions
    ├── pools.ts      # Object pooling
    ├── parser.ts     # Request parsing
    └── errors.ts     # Error handling
```

#### Class Design Patterns
- **Favor composition over inheritance** for better performance
- **Use readonly properties** where possible to prevent accidental mutation
- **Implement interfaces** for all public APIs
- **Design for extension** - Allow custom middleware, plugins, etc.
- **Minimize class instantiation** in hot paths

### Testing Requirements

#### Performance Testing
- **Benchmark against Express/Fastify** for every major feature
- **Load test with concurrent connections** to validate scalability
- **Memory profiling** to detect leaks and inefficient allocations
- **CPU profiling** to identify performance bottlenecks
- **Regression testing** to prevent performance degradation

#### Unit Testing
- **Test Express API compatibility** - Ensure familiar behavior
- **Test error handling** - Verify proper error propagation
- **Test middleware execution** - Validate order and error handling
- **Test request/response methods** - Verify all Express methods work
- **Mock uWebSockets.js** for isolated unit testing

### Development Workflow Rules

#### Before Making Changes
1. **Measure current performance** - Establish baseline metrics
2. **Identify optimization opportunity** - Profile to find bottlenecks
3. **Design performance-conscious solution** - Consider allocation patterns
4. **Implement with benchmarks** - Validate improvements continuously

#### Code Review Checklist
- [ ] No new allocations in hot paths
- [ ] Express API compatibility maintained
- [ ] Proper error handling implemented
- [ ] Memory cleanup handled correctly
- [ ] Performance benchmarks included
- [ ] TypeScript types are strict and accurate
- [ ] Tests cover new functionality

### Optimization Strategies

#### Hot Path Optimization
- **Pre-compile route patterns** during startup, not per request
- **Cache frequently accessed properties** to avoid repeated computation
- **Use string operations** instead of regular expressions where possible
- **Minimize object property lookups** in performance-critical code
- **Batch operations** to reduce function call overhead

#### Memory Optimization
- **Implement object pools** for Request, Response, and other frequent objects
- **Use buffer pooling** for body parsing and response generation
- **Clear circular references** promptly to help garbage collection
- **Monitor memory usage** patterns during development
- **Implement memory pressure detection** for dynamic optimization