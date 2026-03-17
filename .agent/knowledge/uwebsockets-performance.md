# uWebSockets.js Knowledge Base

## Overview
uWebSockets.js is a C++ HTTP/WebSocket server library for Node.js with exceptional performance characteristics. It's designed to be the fastest web server for Node.js applications.

## Key Performance Characteristics

### Speed Benchmarks
- **8.5x faster than Fastify** on simple HTTP requests
- **20x faster than Express** in most scenarios  
- **Sub-millisecond latencies** possible for cached responses
- **Memory efficient** - lower allocation rates than other frameworks
- **Handles 100k+ concurrent connections** on modern hardware

### Architecture Benefits
- **C++ core** with minimal JavaScript overhead
- **Zero-copy operations** where possible
- **Efficient HTTP parsing** with no intermediate allocations
- **Native compression** support (gzip, deflate, brotli)
- **Integrated WebSocket** support without performance penalty

## Core Concepts

### App Instance
```typescript
import { App } from 'uWebSockets.js';

const app = App({
  // SSL options
}).get('/*', (res, req) => {
  res.end('Hello World!');
}).listen(3000, (token) => {
  if (token) {
    console.log('Listening to port 3000');
  } else {
    console.log('Failed to listen to port 3000');
  }
});
```

### Request Handling Patterns
- **Synchronous responses**: Use `res.end()` for immediate responses
- **Asynchronous responses**: Use `res.onAborted()` to handle client disconnection
- **Streaming responses**: Use `res.write()` with proper backpressure handling
- **File serving**: Use `res.writeStatus()` and `res.writeHeader()` for proper HTTP semantics

### Memory Management
- **Request objects are temporary** - don't store references beyond handler scope
- **Response objects** should not be accessed after `res.end()` or `res.close()`
- **Headers and query parameters** must be copied if needed beyond request scope
- **Body parsing** requires careful buffer management

## Performance Best Practices

### Hot Path Optimization
1. **Avoid closures** in request handlers where possible
2. **Pre-compile route patterns** during startup
3. **Cache frequently accessed data** in global scope
4. **Use string concatenation** instead of template literals in hot paths
5. **Minimize object allocations** during request handling

### Routing Optimization
1. **Static routes first** - they can be O(1) lookups
2. **Parameter routes second** - use radix trees for efficiency
3. **Wildcard routes last** - most expensive to match
4. **Compile route handlers** during app initialization
5. **Use route-specific optimizations** for common patterns

### Memory Patterns
1. **Pool objects** for reuse (requests, responses, buffers)
2. **Limit string operations** in favor of buffer manipulation
3. **Clear references promptly** to prevent memory leaks
4. **Use WeakMap** for request-scoped data storage
5. **Monitor heap growth** in production environments

## Common Pitfalls

### Response Handling
- **Never access `res` after `res.end()`** - will cause segmentation fault
- **Always handle `res.onAborted()`** for async operations
- **Don't store `res` in closures** without proper cleanup
- **Use `res.cork()` for multiple writes** to improve performance

### Request Lifecycle
- **Request data is ephemeral** - copy what you need immediately
- **Headers are lowercase** and must be accessed during handler execution
- **Query parameters** must be parsed and copied if needed later
- **Body parsing** requires streaming approach for large payloads

### WebSocket Integration
- **Upgrade handling** must be done carefully to maintain HTTP compatibility
- **Per-socket data** should use the built-in user data system
- **Message handling** should be as lightweight as possible
- **Connection cleanup** is critical for memory management

## Framework Integration Strategies

### Express Compatibility Layer
1. **Request/Response wrappers** to mimic Express API
2. **Middleware chain emulation** with proper async support
3. **Route parameter extraction** compatible with Express patterns
4. **Error handling** that matches Express semantics
5. **Plugin system** for extending functionality

### Performance Monitoring
1. **Request timing** with minimal overhead
2. **Memory usage tracking** per request type
3. **Connection pool monitoring** for WebSocket usage
4. **GC pressure measurement** during high load
5. **Custom metrics collection** without performance impact

## Voltrix Implementation Notes

### Core Design Principles
- **Zero-allocation hot paths** for simple GET requests
- **Express API compatibility** without Express performance penalties
- **Middleware system** optimized for uWS characteristics
- **Route compilation** during startup for maximum runtime performance
- **Memory pooling** for frequently allocated objects

### Architecture Decisions
- **Separate routing engine** optimized for uWS request patterns
- **Middleware pipeline** designed for minimal overhead
- **Error handling** that doesn't compromise performance
- **WebSocket integration** that shares HTTP infrastructure
- **Plugin system** with compile-time optimizations