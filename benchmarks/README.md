# 🚀 Voltrix Benchmarks

Performance benchmarks for Voltrix framework showcasing Direct Actions and ultra-fast O(1) routing.

## 🚀 Quick Start

```bash
# Install dependencies
pnpm install

# Run comprehensive benchmark
npm run bench:comprehensive

# Run specific benchmarks  
npm run bench:simple
npm run bench:vs-express
npm run bench:uws
```

## 📊 Available Benchmarks

### Comprehensive Framework Battle
```bash
npm run bench:comprehensive
```
Tests all major frameworks with realistic scenarios:
- **Express.js** - Traditional middleware-heavy framework
- **Fastify** - Performance-optimized with JSON schemas  
- **Koa.js** - Modern async/await with context objects
- **Hapi.js** - Configuration-centric with built-in validation
- **μWebSockets.js** - Ultra-fast C++ backend
- **Voltrix** - Our Express-compatible high-performance framework

### Individual Performance Tests
```bash
npm run bench:simple      # Basic routing performance
npm run bench:routing     # Route matching performance  
npm run bench:realistic   # Realistic application scenarios
npm run bench:vs-express  # Direct Voltrix vs Express comparison
npm run bench:uws         # μWebSockets.js performance baseline
```

### Decorator Benchmarks
```bash
npm run bench:decorators  # Real decorator implementation tests
npm run bench:metadata    # Metadata performance analysis
```

## 🏗️ Framework Helpers

The `benchmarks/helpers/` directory contains standardized server creation helpers for fair performance comparisons:

- `express.js` - Express.js server with middleware
- `fastify.js` - Fastify server with schemas and hooks
- `koa.js` - Koa.js server with async middleware
- `hapi.js` - Hapi.js server with validation
- `uws.js` - μWebSockets.js server with manual routing
- `voltrix.js` - Voltrix server with Express-like API

Each helper creates servers with:
- Consistent middleware (CORS, JSON parsing, request tracking)
- Identical route structures (static, dynamic, nested)
- Performance monitoring headers
- Proper error handling

## 📈 Benchmark Scenarios

### Test Routes
1. **Root endpoint** (`/`) - Basic response
2. **Health check** (`/health`) - System information
3. **Static routes** (`/api/v1/users/5`) - Simple routing
4. **Dynamic routes** (`/api/v1/users/5/:id`) - Parameter extraction  
5. **Nested routes** (`/api/v1/users/5/posts/:id/comments`) - Complex routing

### Metrics Collected
- **Requests per second (RPS)** - Primary throughput metric
- **Latency percentiles** (p50, p90, p95, p99) - Response times
- **Memory usage** - RAM consumption during tests
- **CPU utilization** - Processing overhead
- **Error rates** - Failure percentages

## 🔧 Configuration

### Test Parameters
```javascript
const testConfig = {
  routes: 25,              // Routes per framework
  middleware: ['cors', 'logger'], // Active middleware
  warmupRequests: 1000,    // Warmup iterations
  benchmarkRequests: 50000, // Benchmark iterations  
  concurrency: 100,        // Concurrent connections
  duration: 30             // Test duration (seconds)
};
```

### Adding New Frameworks

1. Create helper in `benchmarks/helpers/new-framework.js`:
```javascript
export function createNewFrameworkServer(config) {
  return {
    app: frameworkApp,
    start: async (port) => ({ 
      server, 
      close: () => server.close(),
      getStats: () => ({ requestCount, routes, middleware })
    })
  };
}
```

2. Add to benchmark suite in `comprehensive-battle.js`
3. Update dependencies in `package.json`

## 📋 Requirements

- **Node.js** ≥ 18.0.0
- **pnpm** (workspace support)
- **autocannon** - HTTP benchmarking tool
  ```bash
  npm install -g autocannon
  ```

## 📊 Results Interpretation

### Performance Rankings
Results are ranked by average requests per second across all test scenarios.

**Expected Performance Order:**
1. 🥇 **μWebSockets.js** - C++ backend, minimal overhead
2. 🥈 **Voltrix** - Optimized Express-like API on μWebSockets.js
3. 🥉 **Fastify** - Schema validation, optimized serialization
4. **Koa.js** - Modern async/await, lightweight
5. **Express.js** - Feature-rich, mature ecosystem
6. **Hapi.js** - Configuration-heavy, enterprise features

### Key Metrics
- **RPS > 50,000** = Excellent performance
- **RPS 20,000-50,000** = Good performance  
- **RPS 10,000-20,000** = Adequate performance
- **Latency < 5ms** = Excellent responsiveness
- **Memory < 100MB** = Efficient resource usage

## 🎯 Voltrix Performance Goals

- **Primary Goal**: Outperform Express.js by 300-500%
- **Secondary Goal**: Achieve 70-80% of μWebSockets.js raw performance
- **Compatibility Goal**: Maintain Express.js API compatibility
- **Memory Goal**: Use <50% more memory than μWebSockets.js
- **Latency Goal**: Stay within 2x of μWebSockets.js latency

## 📝 Benchmark Reports

Results are automatically formatted with:
- Performance rankings with medals (🥇🥈🥉)
- Detailed scenario breakdowns
- Memory and CPU usage statistics
- Error rate analysis
- Recommendations for optimization

## 🔍 Troubleshooting

### Common Issues
1. **Port conflicts** - Each framework uses different ports (3001-3006)
2. **Missing autocannon** - Install globally: `npm install -g autocannon`
3. **Memory limits** - Reduce concurrent connections for low-memory systems
4. **Timeout errors** - Increase test duration for slower systems

### Debug Mode
Set environment variables for detailed logging:
```bash
DEBUG=voltrix:* npm run bench:comprehensive
NODE_DEBUG=perf_hooks npm run bench:simple
```

## 📚 Documentation

- [HELPERS_GUIDE.md](./HELPERS_GUIDE.md) - Detailed helper usage guide
- [Performance Analysis](./docs/performance-analysis.md) - In-depth results
- [Optimization Tips](./docs/optimization.md) - Framework tuning guide

## 🤝 Contributing

1. Add new benchmark scenarios in `benchmarks/`
2. Create framework helpers with consistent APIs
3. Update documentation and configuration
4. Test with `npm run bench:all`

## 📄 License

MIT - See LICENSE file for details