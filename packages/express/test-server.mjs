// Simple test server para verificar rutas
import { App } from './dist/index.mjs';

const app = new App();

// Basic routes
app.get('/', (req, res) => {
  res.json({
    message: 'Voltrix Express Server Running! 🚀',
    framework: '@voltrix/express',
    available_routes: {
      '/': 'This page',
      '/demo': 'WebSocket demo (fixed)',
      '/demo-simple': 'Simple JSON demo',
      '/health': 'Health check',
      '/users/123': 'User by ID example',
      '/test': 'Test endpoint'
    },
    timestamp: new Date().toISOString()
  });
});

app.get('/demo', (req, res) => {
  res.json({
    message: '🎯 Demo Page - Working!',
    description: 'This is the /demo route that was not found before',
    features: [
      'Express-compatible routing',
      'Ultra-fast uWebSockets.js backend', 
      'App extends Router architecture',
      'Multiple error handlers',
      'WebSocket support ready'
    ],
    fixed: true,
    timestamp: new Date().toISOString()
  });
});

app.get('/demo-simple', (req, res) => {
  res.json({
    message: 'Simple Demo Working! ✅',
    status: 'All routes functional',
    architecture: 'App extends Router successfully implemented'
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy ✅',
    routes_working: true,
    demo_fixed: true
  });
});

app.get('/test', (req, res) => {
  res.json({
    test: 'success',
    message: 'All routes are working correctly!'
  });
});

// 404 handler
app.onNotFound((req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `The route ${req.path} does not exist`,
    available_routes: [
      '/',
      '/demo',
      '/demo-simple', 
      '/health',
      '/test',
      '/users/:id'
    ],
    suggestion: 'Try one of the available routes above'
  });
});

// Add middleware to log all requests
app.use((req, res, next) => {
  console.log(`📨 ${req.method} ${req.path} - ${new Date().toISOString()}`);
  next();
});

console.log('🚀 Starting Voltrix test server...');
app.listen(3000, (success) => {
  if (success) {
    console.log('✅ Server running on http://localhost:3000');
    console.log('📋 Available routes:');
    console.log('   GET / - Main page');
    console.log('   GET /demo - Demo page (FIXED)');
    console.log('   GET /demo-simple - Simple demo');
    console.log('   GET /health - Health check'); 
    console.log('   GET /test - Test endpoint');
  } else {
    console.log('❌ Failed to start server');
  }
});