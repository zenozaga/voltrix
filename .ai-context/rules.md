# Voltrix Framework Rules and Conventions

## Code Style and Standards

### TypeScript Guidelines
- Use TypeScript for all source code with strict mode enabled
- Target ES2022+ for modern JavaScript features
- Enable all strict TypeScript compiler options
- Use meaningful variable and function names focused on performance intent
- Prefer `const` over `let`, never use `var`
- Use arrow functions for performance-critical hot paths
- Implement comprehensive error handling with typed error classes
- Document performance characteristics in JSDoc comments

### Performance-First Coding Rules
- **ZERO allocations in hot paths** - reuse objects where possible
- Avoid `async/await` in critical performance paths if sync alternatives exist
- Use `Buffer` instead of string concatenation for binary data
- Prefer `for` loops over array methods in performance-critical code
- Cache frequently accessed properties and computations
- Use `Object.freeze()` for immutable configuration objects
- Profile memory usage and CPU time for all core components

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

## Testing Standards

### Unit Testing with Vitest
- Write tests for all public functions using Vitest framework
- Maintain excellent test coverage (current: 82/82 tests passing)
- Use descriptive test names that explain the scenario
- Mock external dependencies appropriately using vi.mock()
- Utilize Vitest's native TypeScript support and fast execution
- Generate HTML coverage reports with @vitest/coverage-v8
- **Critical**: Test direct class references in server collections
- Test enterprise features: health monitoring, auto-restart, graceful shutdown
- Test middleware execution pipelines and error handling

### Integration Testing
- Test MCP protocol integration points
- Validate middleware execution pipeline workflows
- Test decorator functionality and metadata processing
- Test error scenarios and edge cases
- Validate multi-server orchestration scenarios

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

## Performance Guidelines

### Optimization
- Profile code performance regularly
- Optimize database queries and API calls
- Implement caching where appropriate
- Monitor memory usage and prevent leaks

### Scalability
- Design for horizontal scaling
- Use asynchronous processing for heavy operations
- Implement proper resource cleanup
- Consider rate limiting for API endpoints