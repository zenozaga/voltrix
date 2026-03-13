import { Voltrix as App } from '@voltrix/express';

/**
 * Benchmark específico para comparar el rendimiento de routing
 * Compara el rendimiento de rutas estáticas vs dinámicas
 */

class RoutingBenchmark {
  constructor() {
    this.app = null;
    this.server = null;
    this.requestCount = 0;
  }

  async setup() {
    console.log('🔧 Configurando benchmark de routing...');
    
    this.app = new App();

    // Middleware contador
    this.app.use((req, res, next) => {
      this.requestCount++;
      next();
    });

    // RUTAS ESTÁTICAS (deberían ser O(1) con router optimizado)
    this.app.get('/', (req, res) => {
      res.json({ type: 'static', path: '/', requests: this.requestCount });
    });

    this.app.get('/api', (req, res) => {
      res.json({ type: 'static', path: '/api', requests: this.requestCount });
    });

    this.app.get('/health', (req, res) => {
      res.json({ type: 'static', path: '/health', requests: this.requestCount });
    });

    this.app.get('/status', (req, res) => {
      res.json({ type: 'static', path: '/status', requests: this.requestCount });
    });

    this.app.get('/users', (req, res) => {
      res.json({ type: 'static', path: '/users', requests: this.requestCount });
    });

    // RUTAS DINÁMICAS (deberían usar cache LRU y regex optimizado)
    this.app.get('/users/:id', (req, res) => {
      res.json({ 
        type: 'dynamic',
        path: '/users/:id', 
        params: req.params,
        requests: this.requestCount 
      });
    });

    this.app.get('/posts/:postId/comments/:commentId', (req, res) => {
      res.json({ 
        type: 'dynamic',
        path: '/posts/:postId/comments/:commentId', 
        params: req.params,
        requests: this.requestCount 
      });
    });

    this.app.get('/api/v1/:resource/:id', (req, res) => {
      res.json({ 
        type: 'dynamic',
        path: '/api/v1/:resource/:id', 
        params: req.params,
        requests: this.requestCount 
      });
    });

    this.app.get('/files/:category/:subcategory/:filename', (req, res) => {
      res.json({ 
        type: 'dynamic',
        path: '/files/:category/:subcategory/:filename', 
        params: req.params,
        requests: this.requestCount 
      });
    });

    console.log('✅ Rutas configuradas:');
    console.log('   📍 Rutas estáticas: 5 rutas');
    console.log('   🔀 Rutas dinámicas: 4 rutas');
  }

  async startServer(port = 3010) {
    return new Promise((resolve, reject) => {
      this.app.listen(port, sock => {
        if (sock) {
          this.server = sock;
          console.log(`🚀 Servidor de routing benchmark iniciado en puerto ${port}`);
          resolve();
        } else {
          reject(new Error(`Failed to listen on port ${port}`));
        }
      });
    });
  }

  async stopServer() {
    if (this.app) {
      await this.app.close();
      console.log('🔄 Servidor detenido');
    }
  }

  async benchmarkRoute(url, requests = 1000, description = '') {
    console.log(`\n📊 Benchmarking: ${description}`);
    console.log(`🎯 URL: ${url}`);
    console.log(`🔢 Requests: ${requests}`);

    const batchSize = 100;
    const results = [];
    
    // Warmup
    await fetch(url).then(res => res.json()).catch(() => {});
    
    const start = process.hrtime.bigint();
    
    for (let i = 0; i < requests; i += batchSize) {
      const currentBatchSize = Math.min(batchSize, requests - i);
      const batchPromises = [];
      
      for (let j = 0; j < currentBatchSize; j++) {
        batchPromises.push(
          fetch(url)
            .then(res => (res.ok ? res.json() : null))
            .catch(() => null)
        );
      }
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }
    
    const end = process.hrtime.bigint();
    
    const duration = Number(end - start) / 1_000_000; // ms
    const rps = Math.round((requests / duration) * 1000);
    const successful = results.filter(r => r !== null).length;

    console.log(`✅ ${rps.toLocaleString()} req/s (${successful}/${requests} exitosos)`);
    
    return {
      url,
      description,
      requests,
      successful,
      rps,
      duration,
      avgLatency: duration / requests
    };
  }

  async runFullBenchmark() {
    console.log('🚀 BENCHMARK DE ROUTING OPTIMIZADO');
    console.log('='.repeat(60));
    
    await this.setup();
    await this.startServer();

    try {
      const results = [];
      const COUNT = 500;

      // Test rutas estáticas
      console.log('\n🏎️  RUTAS ESTÁTICAS (HashMap O(1)):');
      results.push(await this.benchmarkRoute('http://localhost:3010/', COUNT, 'Ruta root'));
      results.push(await this.benchmarkRoute('http://localhost:3010/api', COUNT, 'Ruta API'));
      results.push(await this.benchmarkRoute('http://localhost:3010/health', COUNT, 'Ruta health'));
      results.push(await this.benchmarkRoute('http://localhost:3010/status', COUNT, 'Ruta status'));
      results.push(await this.benchmarkRoute('http://localhost:3010/users', COUNT, 'Ruta users'));

      // Test rutas dinámicas
      console.log('\n🔀 RUTAS DINÁMICAS (Cache LRU + Regex):');
      results.push(await this.benchmarkRoute('http://localhost:3010/users/123', COUNT, 'Usuario por ID'));
      results.push(await this.benchmarkRoute('http://localhost:3010/posts/456/comments/789', COUNT, 'Post + Comment'));
      results.push(await this.benchmarkRoute('http://localhost:3010/api/v1/products/100', COUNT, 'API v1 resource'));
      results.push(await this.benchmarkRoute('http://localhost:3010/files/images/avatars/user.jpg', COUNT, 'File path'));

      // Test cache benefits
      console.log('\n🎯 BENEFICIO DE CACHE:');
      results.push(await this.benchmarkRoute('http://localhost:3010/users/123', COUNT, 'Usuario (cached)'));

      // Análisis de resultados
      console.log('\n📈 ANÁLISIS DE RESULTADOS:');
      console.log('='.repeat(60));
      
      const staticRoutes = results.filter(r => r.description.includes('Ruta'));
      const dynamicRoutes = results.filter(r => !r.description.includes('Ruta') && !r.description.includes('cached'));
      const cachedRoute = results.find(r => r.description.includes('cached'));

      const avgStatic = staticRoutes.reduce((sum, r) => sum + r.rps, 0) / (staticRoutes.length || 1);
      const avgDynamic = dynamicRoutes.reduce((sum, r) => sum + r.rps, 0) / (dynamicRoutes.length || 1);

      console.log(`🏎️  Rutas estáticas promedio: ${Math.round(avgStatic).toLocaleString()} req/s`);
      console.log(`🔀 Rutas dinámicas promedio: ${Math.round(avgDynamic).toLocaleString()} req/s`);
      if (cachedRoute) console.log(`🎯 Ruta cacheada: ${cachedRoute.rps.toLocaleString()} req/s`);
      
      const staticVsDynamic = ((avgStatic - avgDynamic) / (avgDynamic || 1) * 100).toFixed(1);
      
      console.log(`\n📊 COMPARACIÓN:`);
      console.log(`   📈 Rutas estáticas son ${staticVsDynamic}% más rápidas que dinámicas`);
      if (cachedRoute) {
        const cacheBoost = ((cachedRoute.rps - avgDynamic) / (avgDynamic || 1) * 100).toFixed(1);
        console.log(`   🚀 Cache boost: ${cacheBoost}% más rápido en segunda llamada`);
      }
      
      console.log(`\n🔧 DETALLES TÉCNICOS:`);
      console.log(`   📍 Requests totales procesados: ${this.requestCount.toLocaleString()}`);
      console.log(`   ⚡ Backend: uWebSockets.js`);
      console.log(`   🎯 Router: Optimizado con HashMap + LRU Cache`);

    } finally {
      await this.stopServer();
    }
  }
}

// Ejecutar benchmark
const benchmark = new RoutingBenchmark();
benchmark.runFullBenchmark().catch(console.error);