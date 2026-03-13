# Create Performance Benchmarks

## Overview
Develop a comprehensive benchmarking suite to measure Voltrix performance against other Node.js web frameworks and validate optimization goals.

## Objectives
- Benchmark against Express, Fastify, Hono, and other uWS-based frameworks
- Measure throughput, latency, memory usage, and CPU utilization
- Create automated benchmark reporting
- Establish performance regression testing

## Benchmark Categories

### 1. Basic HTTP Benchmarks

#### Simple GET Request
```typescript
// benchmarks/simple-get.ts
import { App } from '@voltrix/express';
import express from 'express';
import Fastify from 'fastify';

// Voltrix benchmark
export function setupVoltrix() {
  const app = new App();
  app.get('/', (req, res) => {
    res.send('Hello World!');
  });
  return app;
}

// Express benchmark  
export function setupExpress() {
  const app = express();
  app.get('/', (req, res) => {
    res.send('Hello World!');
  });
  return app;
}

// Fastify benchmark
export async function setupFastify() {
  const fastify = Fastify();
  fastify.get('/', async (request, reply) => {
    return 'Hello World!';
  });
  await fastify.ready();
  return fastify;
}
```

#### JSON Response Benchmark
```typescript
// benchmarks/json-response.ts
const testData = {
  message: 'Hello World',
  timestamp: new Date().toISOString(),
  data: Array.from({ length: 100 }, (_, i) => ({ id: i, value: `item-${i}` }))
};

// Voltrix JSON benchmark
export function setupVoltrixJSON() {
  const app = new App();
  app.get('/json', (req, res) => {
    res.json(testData);
  });
  return app;
}
```

### 2. Routing Performance Benchmarks

#### Parameter Extraction
```typescript
// benchmarks/routing.ts
export function setupVoltrixRouting() {
  const app = new App();
  
  // Static routes
  app.get('/static1', (req, res) => res.send('static1'));
  app.get('/static2', (req, res) => res.send('static2'));
  
  // Parameterized routes
  app.get('/users/:id', (req, res) => res.json({ id: req.params.id }));
  app.get('/users/:id/posts/:postId', (req, res) => {
    res.json({ userId: req.params.id, postId: req.params.postId });
  });
  
  // Wildcard routes
  app.get('/files/*', (req, res) => res.send('file served'));
  
  return app;
}
```

### 3. Middleware Performance

#### Middleware Chain Benchmark
```typescript
// benchmarks/middleware.ts
export function setupVoltrixMiddleware() {
  const app = new App();
  
  // Multiple middlewares
  app.use((req, res, next) => {
    req.startTime = Date.now();
    next();
  });
  
  app.use((req, res, next) => {
    req.requestId = Math.random().toString(36).substring(7);
    next();
  });
  
  app.use((req, res, next) => {
    res.set('X-Request-ID', req.requestId);
    next();
  });
  
  app.get('/middleware', (req, res) => {
    const duration = Date.now() - req.startTime;
    res.json({ 
      message: 'Middleware processed',
      duration,
      requestId: req.requestId 
    });
  });
  
  return app;
}
```

### 4. Concurrent Connection Benchmarks

#### WebSocket + HTTP Mixed Load
```typescript
// benchmarks/concurrent.ts
export function setupVoltrixConcurrent() {
  const app = new App();
  
  // HTTP endpoints
  app.get('/api/data', (req, res) => {
    res.json({ data: 'concurrent test', timestamp: Date.now() });
  });
  
  app.post('/api/submit', (req, res) => {
    res.json({ received: true, id: Math.random() });
  });
  
  // TODO: Add WebSocket benchmarks when implemented
  
  return app;
}
```

## Benchmark Infrastructure

### Benchmark Runner
```typescript
// benchmarks/runner.ts
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface BenchmarkResult {
  framework: string;
  test: string;
  requestsPerSecond: number;
  latency: {
    mean: number;
    p50: number;
    p95: number;
    p99: number;
  };
  throughput: number;
  errors: number;
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
  cpuUsage: number;
}

export class BenchmarkRunner {
  private frameworks = ['voltrix', 'express', 'fastify', 'hono'];
  private tests = ['simple-get', 'json-response', 'routing', 'middleware'];
  
  async runAllBenchmarks(): Promise<BenchmarkResult[]> {
    const results: BenchmarkResult[] = [];
    
    for (const framework of this.frameworks) {
      for (const test of this.tests) {
        console.log(`Running ${framework} - ${test}`);
        const result = await this.runBenchmark(framework, test);
        results.push(result);
      }
    }
    
    return results;
  }
  
  private async runBenchmark(framework: string, test: string): Promise<BenchmarkResult> {
    // Start the server
    const serverProcess = await this.startServer(framework, test);
    
    // Wait for server to be ready
    await this.waitForServer('http://localhost:3000');
    
    // Run autocannon benchmark
    const benchmarkCmd = `autocannon -c 100 -d 30 -j http://localhost:3000`;
    const { stdout } = await execAsync(benchmarkCmd);
    const autocannonResult = JSON.parse(stdout);
    
    // Get memory usage
    const memoryUsage = process.memoryUsage();
    
    // Kill server process
    serverProcess.kill();
    
    return {
      framework,
      test,
      requestsPerSecond: autocannonResult.requests.average,
      latency: {
        mean: autocannonResult.latency.mean,
        p50: autocannonResult.latency.p50,
        p95: autocannonResult.latency.p95,
        p99: autocannonResult.latency.p99
      },
      throughput: autocannonResult.throughput.average,
      errors: autocannonResult.errors,
      memoryUsage,
      cpuUsage: await this.getCPUUsage()
    };
  }
  
  private async startServer(framework: string, test: string): Promise<any> {
    // Implementation to start different framework servers
    return exec(`node benchmarks/servers/${framework}-${test}.js`);
  }
  
  private async waitForServer(url: string): Promise<void> {
    // Implementation to wait for server readiness
  }
  
  private async getCPUUsage(): Promise<number> {
    // Implementation to get CPU usage percentage
    return 0;
  }
}
```

### Benchmark Reporting
```typescript
// benchmarks/reporter.ts
export class BenchmarkReporter {
  generateReport(results: BenchmarkResult[]): string {
    let report = '# Voltrix Performance Benchmark Results\n\n';
    
    // Group results by test
    const testGroups = this.groupByTest(results);
    
    for (const [test, testResults] of Object.entries(testGroups)) {
      report += `## ${test}\n\n`;
      
      // Create comparison table
      report += '| Framework | RPS | Latency (mean) | P95 | P99 | Memory (MB) |\n';
      report += '|-----------|-----|----------------|-----|-----|-------------|\n';
      
      // Sort by RPS (descending)
      testResults.sort((a, b) => b.requestsPerSecond - a.requestsPerSecond);
      
      testResults.forEach(result => {
        const memoryMB = (result.memoryUsage.heapUsed / 1024 / 1024).toFixed(2);
        report += `| ${result.framework} | ${result.requestsPerSecond.toFixed(0)} | ${result.latency.mean.toFixed(2)}ms | ${result.latency.p95.toFixed(2)}ms | ${result.latency.p99.toFixed(2)}ms | ${memoryMB} |\n`;
      });
      
      report += '\n';
      
      // Add performance comparison
      const fastest = testResults[0];
      const voltrixResult = testResults.find(r => r.framework === 'voltrix');
      
      if (voltrixResult && fastest.framework === 'voltrix') {
        const secondFastest = testResults[1];
        const improvement = ((voltrixResult.requestsPerSecond - secondFastest.requestsPerSecond) / secondFastest.requestsPerSecond * 100).toFixed(1);
        report += `**Voltrix is ${improvement}% faster than ${secondFastest.framework}**\n\n`;
      }
    }
    
    return report;
  }
  
  private groupByTest(results: BenchmarkResult[]): Record<string, BenchmarkResult[]> {
    return results.reduce((groups, result) => {
      if (!groups[result.test]) {
        groups[result.test] = [];
      }
      groups[result.test].push(result);
      return groups;
    }, {} as Record<string, BenchmarkResult[]>);
  }
}
```

## Automated Benchmark Scripts

### package.json Scripts
```json
{
  "scripts": {
    "bench": "tsx benchmarks/run-all.ts",
    "bench:simple": "tsx benchmarks/simple-get.ts",
    "bench:json": "tsx benchmarks/json-response.ts",
    "bench:routing": "tsx benchmarks/routing.ts",
    "bench:middleware": "tsx benchmarks/middleware.ts",
    "bench:report": "tsx benchmarks/generate-report.ts"
  }
}
```

### CI/CD Integration
```yaml
# .github/workflows/benchmarks.yml
name: Performance Benchmarks

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  benchmark:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      
      - name: Install dependencies
        run: pnpm install
      
      - name: Build packages
        run: pnpm build
      
      - name: Run benchmarks
        run: pnpm bench
      
      - name: Upload benchmark results
        uses: actions/upload-artifact@v3
        with:
          name: benchmark-results
          path: benchmarks/results/
```

## Performance Targets

### Success Criteria
- **50%+ faster than Fastify** on simple GET requests
- **Sub-millisecond P95 latency** for cached responses
- **Lower memory usage** than Express and Fastify
- **Higher throughput** than other uWebSockets.js frameworks
- **Linear scaling** with CPU cores

### Monitoring and Alerts
- Set up performance regression alerts
- Automated benchmark running on PR creation
- Performance tracking dashboard
- Historical performance trend analysis

## Expected Outcomes

- ✅ Comprehensive benchmark suite covering all use cases
- ✅ Automated performance regression detection
- ✅ Competitive analysis against major frameworks
- ✅ Performance optimization guidance based on results
- ✅ CI/CD integrated benchmark reporting
- ✅ Historical performance tracking