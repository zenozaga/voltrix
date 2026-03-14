import UWS from 'uWebSockets.js';

/**
 * Benchmark de uWebSockets.js PURO
 * Sin abstracciones, sin capas extras.
 */

class PureUWSBenchmark {
  constructor() {
    this.listenSocket = null;
    this.requestCount = 0;
  }

  async setup() {
    const app = UWS.App();

    // RUTAS ESTÁTICAS
    app.get('/', (res) => {
      this.requestCount++;
      res.writeStatus('200 OK');
      res.writeHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ type: 'static', path: '/', requests: this.requestCount }));
    });

    app.get('/api', (res) => {
      this.requestCount++;
      res.writeStatus('200 OK');
      res.writeHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ type: 'static', path: '/api', requests: this.requestCount }));
    });

    app.get('/health', (res) => {
      this.requestCount++;
      res.writeStatus('200 OK');
      res.writeHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ type: 'static', path: '/health', requests: this.requestCount }));
    });

    app.get('/status', (res) => {
      this.requestCount++;
      res.writeStatus('200 OK');
      res.writeHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ type: 'static', path: '/status', requests: this.requestCount }));
    });

    app.get('/users', (res) => {
      this.requestCount++;
      res.writeStatus('200 OK');
      res.writeHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ type: 'static', path: '/users', requests: this.requestCount }));
    });

    // RUTAS DINÁMICAS
    app.get('/users/:id', (res, req) => {
      this.requestCount++;
      const id = req.getParameter(0);
      res.writeStatus('200 OK');
      res.writeHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ 
        type: 'dynamic',
        path: '/users/:id', 
        params: { id },
        requests: this.requestCount 
      }));
    });

    app.get('/posts/:postId/comments/:commentId', (res, req) => {
      this.requestCount++;
      const postId = req.getParameter(0);
      const commentId = req.getParameter(1);
      res.writeStatus('200 OK');
      res.writeHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ 
        type: 'dynamic',
        path: '/posts/:postId/comments/:commentId', 
        params: { postId, commentId },
        requests: this.requestCount 
      }));
    });

    app.get('/api/v1/:resource/:id', (res, req) => {
      this.requestCount++;
      const resource = req.getParameter(0);
      const id = req.getParameter(1);
      res.writeStatus('200 OK');
      res.writeHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ 
        type: 'dynamic',
        path: '/api/v1/:resource/:id', 
        params: { resource, id },
        requests: this.requestCount 
      }));
    });

    app.get('/files/:category/:subcategory/:filename', (res, req) => {
      this.requestCount++;
      const category = req.getParameter(0);
      const subcategory = req.getParameter(1);
      const filename = req.getParameter(2);
      res.writeStatus('200 OK');
      res.writeHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ 
        type: 'dynamic',
        path: '/files/:category/:subcategory/:filename', 
        params: { category, subcategory, filename },
        requests: this.requestCount 
      }));
    });

    this.app = app;
  }

  async startServer(port = 3011) {
    return new Promise((resolve, reject) => {
      this.app.listen(port, (token) => {
        if (token) {
          this.listenSocket = token;
          console.log(`🚀 Pure uWS Benchmark iniciado en puerto ${port}`);
          resolve();
        } else {
          reject(new Error('Failed to listen'));
        }
      });
    });
  }

  async stopServer() {
    if (this.listenSocket) {
      UWS.us_listen_socket_close(this.listenSocket);
      this.listenSocket = null;
      console.log('🔄 Servidor uWS detenido');
    }
  }

  async benchmarkRoute(url, requests = 2000, description = '') {
    console.log(`\n📊 Benchmarking: ${description}`);
    const batchSize = 250;
    const results = [];
    
    // Warmup
    for (let i = 0; i < 500; i++) {
        await fetch(url).catch(() => {});
    }
    
    const start = process.hrtime.bigint();
    for (let i = 0; i < requests; i += batchSize) {
      const currentBatchSize = Math.min(batchSize, requests - i);
      const batchPromises = [];
      for (let j = 0; j < currentBatchSize; j++) {
        batchPromises.push(fetch(url).then(res => res.ok).catch(() => false));
      }
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }
    const end = process.hrtime.bigint();
    
    const duration = Number(end - start) / 1_000_000;
    const rps = Math.round((requests / duration) * 1000);
    console.log(`✅ ${rps.toLocaleString()} req/s`);
    
    return rps;
  }

  async run() {
    console.log('🔥 PURE uWebSockets.js BENCHMARK');
    await this.setup();
    await this.startServer();

    try {
      const COUNT = 2000;
      const staticRps = [];
      staticRps.push(await this.benchmarkRoute('http://localhost:3011/', COUNT, 'Static Root'));
      staticRps.push(await this.benchmarkRoute('http://localhost:3011/api', COUNT, 'Static API'));
      
      const dynamicRps = [];
      dynamicRps.push(await this.benchmarkRoute('http://localhost:3011/users/123', COUNT, 'Dynamic User'));
      dynamicRps.push(await this.benchmarkRoute('http://localhost:3011/posts/456/comments/789', COUNT, 'Dynamic Post'));

      const avgStatic = staticRps.reduce((a,b) => a+b, 0) / staticRps.length;
      const avgDynamic = dynamicRps.reduce((a,b) => a+b, 0) / dynamicRps.length;

      console.log('\n📈 RESULTADOS PURE uWS:');
      console.log(`🏎️  Estáticas promedio: ${Math.round(avgStatic).toLocaleString()} req/s`);
      console.log(`🔀 Dinámicas promedio: ${Math.round(avgDynamic).toLocaleString()} req/s`);
      
    } finally {
      await this.stopServer();
    }
  }
}

new PureUWSBenchmark().run().catch(console.error);
