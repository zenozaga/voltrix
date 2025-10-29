import { App } from '../packages/express/dist/app.js';

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
    return new Promise((resolve) => {
      this.server = this.app.listen(port, '0.0.0.0', () => {
        console.log(`🚀 Servidor de routing benchmark iniciado en puerto ${port}`);
        resolve();
      });
    });
  }

  async stopServer() {
    if (this.server) {
      await new Promise((resolve) => {
        this.server.close(resolve);
      });
      console.log('🔄 Servidor detenido');
    }
  }

  async benchmarkRoute(url, requests = 1000, description = '') {
    console.log(`\n📊 Benchmarking: ${description}`);
    console.log(`🎯 URL: ${url}`);
    console.log(`🔢 Requests: ${requests}`);

    const startRequests = this.requestCount;
    const start = process.hrtime.bigint();
    
    // Warmup
    await fetch(url);
    
    const promises = [];
    for (let i = 0; i < requests; i++) {
      promises.push(
        fetch(url)
          .then(res => res.json())
          .catch(() => null)
      );
    }

    const results = await Promise.all(promises);
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

      // Test rutas estáticas (deberían ser más rápidas con HashMap lookup)
      console.log('\n🏎️  RUTAS ESTÁTICAS (HashMap O(1)):');
      results.push(await this.benchmarkRoute('http://localhost:3010/', 2000, 'Ruta root'));
      results.push(await this.benchmarkRoute('http://localhost:3010/api', 2000, 'Ruta API'));
      results.push(await this.benchmarkRoute('http://localhost:3010/health', 2000, 'Ruta health'));
      results.push(await this.benchmarkRoute('http://localhost:3010/status', 2000, 'Ruta status'));
      results.push(await this.benchmarkRoute('http://localhost:3010/users', 2000, 'Ruta users'));

      // Test rutas dinámicas (deberían beneficiarse de cache LRU)
      console.log('\n🔀 RUTAS DINÁMICAS (Cache LRU + Regex):');
      results.push(await this.benchmarkRoute('http://localhost:3010/users/123', 2000, 'Usuario por ID'));
      results.push(await this.benchmarkRoute('http://localhost:3010/posts/456/comments/789', 2000, 'Post + Comment'));
      results.push(await this.benchmarkRoute('http://localhost:3010/api/v1/products/100', 2000, 'API v1 resource'));
      results.push(await this.benchmarkRoute('http://localhost:3010/files/images/avatars/user.jpg', 2000, 'File path'));

      // Test cache benefits - repetir la misma ruta dinámica
      console.log('\n🎯 BENEFICIO DE CACHE (misma ruta repetida):');
      results.push(await this.benchmarkRoute('http://localhost:3010/users/123', 3000, 'Usuario (cached)'));

      // Análisis de resultados
      console.log('\n📈 ANÁLISIS DE RESULTADOS:');
      console.log('='.repeat(60));
      
      const staticRoutes = results.slice(0, 5);
      const dynamicRoutes = results.slice(5, 9);
      const cachedRoute = results[9];

      const avgStatic = staticRoutes.reduce((sum, r) => sum + r.rps, 0) / staticRoutes.length;
      const avgDynamic = dynamicRoutes.reduce((sum, r) => sum + r.rps, 0) / dynamicRoutes.length;

      console.log(`🏎️  Rutas estáticas promedio: ${Math.round(avgStatic).toLocaleString()} req/s`);
      console.log(`🔀 Rutas dinámicas promedio: ${Math.round(avgDynamic).toLocaleString()} req/s`);
      console.log(`🎯 Ruta cacheada: ${cachedRoute.rps.toLocaleString()} req/s`);
      
      const staticVsDynamic = ((avgStatic - avgDynamic) / avgDynamic * 100).toFixed(1);
      const cacheBoost = ((cachedRoute.rps - avgDynamic) / avgDynamic * 100).toFixed(1);
      
      console.log(`\n📊 COMPARACIÓN:`);
      console.log(`   📈 Rutas estáticas son ${staticVsDynamic}% más rápidas que dinámicas`);
      console.log(`   🚀 Cache boost: ${cacheBoost}% más rápido en segunda llamada`);
      
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