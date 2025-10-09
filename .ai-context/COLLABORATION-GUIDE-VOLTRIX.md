# Voltrix Framework Collaboration Guide

## 🚀 **Project Overview**

### What Voltrix Does
**Voltrix** is a high-performance TypeScript web framework that provides an Express-compatible API built on top of uWebSockets.js. It's designed to be significantly faster than existing Node.js web frameworks while maintaining familiar Express patterns.

### Key Innovation: Performance + Compatibility
Instead of choosing between performance and developer experience, Voltrix provides both:

```typescript
// Express-familiar API
const app = new App();
app.get('/users/:id', (req, res) => {
  res.json({ id: req.params.id });
});

// But with uWebSockets.js performance under the hood
app.listen(3000); // 50%+ faster than Fastify
```

## 🎯 **Performance Goals**

- **50%+ faster than Fastify** on simple HTTP requests
- **Sub-millisecond P95 latency** for cached responses
- **Lower memory usage** than Express and Fastify
- **100k+ concurrent connections** on modern hardware
- **Express API compatibility** without performance penalties

## 🏗️ **Monorepo Architecture**

### Package Structure
```
packages/
├── express/           # @voltrix/express - Core framework
├── router/           # @voltrix/router - Advanced routing engine  
├── middleware/       # @voltrix/middleware - Middleware system
├── websocket/        # @voltrix/websocket - WebSocket integration
├── plugins/          # @voltrix/plugins - Plugin architecture
├── benchmarks/       # @voltrix/benchmarks - Performance testing
└── examples/         # @voltrix/examples - Usage examples
```

### Technology Stack
- **TypeScript**: Strict typing with ES2022+ features
- **uWebSockets.js**: C++ HTTP/WebSocket server library
- **pnpm**: Monorepo and dependency management
- **tsup**: Fast compilation and bundling
- **vitest**: Testing with performance focus
- **ESLint/Prettier**: Code quality and formatting

## 👥 **Collaboration Workflow**

### Getting Started (New Contributors)
1. **Read the project context** in `.ai-context/`
2. **Setup development environment** using [setup_development.md](tasks/setup_development.md)
3. **Run benchmarks** to understand performance baselines
4. **Pick a task** from the tasks directory
5. **Follow performance-first coding principles**

### Development Principles

#### Performance-First Mindset
- **Profile before optimizing** - measure everything
- **Zero allocations in hot paths** - reuse objects
- **Benchmark every change** - regression prevention
- **Memory efficiency** - pool objects, avoid leaks
- **CPU optimization** - minimize work per request

#### Code Quality Standards
```typescript
// ✅ Good: Performance-optimized
function fastHandler(req: Request, res: Response) {
  // Reuse cached response object
  const data = responsePool.get();
  data.id = req.params.id;
  res.json(data);
  responsePool.release(data);
}

// ❌ Bad: Creates new objects every request
function slowHandler(req: Request, res: Response) {
  res.json({ id: req.params.id });
}
```

### Task-Based Development
Each feature follows this workflow:
1. **Performance analysis** - understand the impact
2. **Benchmark baseline** - measure current performance
3. **Implementation** - build with performance in mind
4. **Validation** - verify performance improvements
5. **Documentation** - share learnings and patterns

## 🧪 **Testing & Benchmarking**

### Test Categories
- **Unit tests**: Individual function performance
- **Integration tests**: Component interaction efficiency
- **Benchmarks**: Framework comparison metrics
- **Load tests**: Concurrent connection handling

### Benchmark Requirements
Every major change must include:
- **Before/after metrics** showing performance impact
- **Memory usage analysis** to prevent memory leaks
- **Comparison with competitors** (Express, Fastify, etc.)
- **Regression tests** to prevent performance degradation

### Performance Monitoring
```bash
# Run comprehensive benchmarks
pnpm bench

# Specific performance tests
pnpm bench:simple-get
pnpm bench:json-response  
pnpm bench:routing
pnpm bench:middleware

# Memory profiling
pnpm bench:memory
```

## 📚 **Knowledge Sharing**

### Documentation Standards
- **Performance characteristics** documented for each component
- **Optimization techniques** shared in knowledge base
- **Benchmark results** tracked over time
- **Best practices** updated based on learnings

### Code Review Focus
- **Performance impact** of all changes
- **Memory allocation patterns** in hot paths
- **API compatibility** with Express patterns
- **Type safety** and error handling
- **Test coverage** including benchmarks

## 🚀 **Release Strategy**

### Version Progression
- **0.1.x**: Core framework foundation
- **0.2.x**: Advanced routing and middleware
- **0.3.x**: WebSocket integration
- **0.4.x**: Plugin architecture  
- **1.0.x**: Production-ready release

### Performance Milestones
Each release must demonstrate:
- **Measurable performance improvements**
- **No performance regressions**
- **Comprehensive benchmark coverage**
- **Real-world application validation**

## 🔧 **Development Commands**

```bash
# Initial setup
pnpm install
pnpm build

# Development workflow
pnpm dev                # Watch mode development
pnpm test               # Run all tests
pnpm test:watch         # Test watch mode
pnpm bench              # Performance benchmarks
pnpm type-check         # TypeScript validation
pnpm lint               # Code quality check

# Package-specific work
pnpm --filter @voltrix/express build
pnpm --filter @voltrix/router test
pnpm --filter @voltrix/benchmarks bench
```

## 🤝 **Contributing Guidelines**

### Before Making Changes
1. **Understand the performance impact** of your change
2. **Review existing benchmarks** for similar functionality
3. **Plan your optimization strategy** before coding
4. **Consider API compatibility** with Express patterns

### Pull Request Requirements
- **Benchmark results** showing performance impact
- **Test coverage** including performance tests
- **Documentation updates** for new features
- **Type safety** validation
- **Memory usage analysis** for significant changes

### Performance Review Criteria
- Does this change improve or maintain performance?
- Are there any new memory allocations in hot paths?
- Is the API compatible with Express patterns?
- Are benchmarks comprehensive and accurate?
- Is the optimization sustainable and maintainable?

## 📊 **Success Metrics**

### Technical KPIs
- **Requests per second** vs competitors
- **Response latency** percentiles (P50, P95, P99)
- **Memory efficiency** vs baseline frameworks
- **CPU utilization** optimization
- **Test coverage** percentage

### Community Goals
- **Developer adoption** through performance benefits
- **Community contributions** to optimization efforts
- **Real-world deployments** showcasing performance
- **Knowledge sharing** of optimization techniques
- **Framework ecosystem** growth