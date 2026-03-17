/**
 * 🔍 Debug test para entender el orden de middleware
 */

import { App } from '@voltrix/express';

function debugMiddlewareOrder() {
  console.log('🔍 DEBUG: Orden de Middleware');
  console.log('='.repeat(40));

  const app = new App();

  console.log('1. Registrando primer middleware global...');
  app.use((req, res, next) => {
    console.log('   🔵 Ejecutando: Global 1');
    next();
  });

  console.log('2. Registrando middleware para /api...');
  app.use('/api', (req, res, next) => {
    console.log('   🟡 Ejecutando: API Middleware');
    next();
  });

  console.log('3. Registrando segundo middleware global...');
  app.use((req, res, next) => {
    console.log('   🔵 Ejecutando: Global 2');
    next();
  });

  app.get('/api/test', (req, res) => {
    console.log('   🟢 Ejecutando: Handler');
    res.json({ message: 'OK' });
  });

  // Acceder a los middleware internos para debug
  console.log('\n📋 MIDDLEWARE REGISTRADOS (en orden):');
  const middlewares = app.appMiddlewares || [];
  middlewares.forEach((mw, index) => {
    const type = mw.path ? `Path: ${mw.path}` : 'Global';
    console.log(`   ${index + 1}. ${type}`);
  });

  app.listen(3013, (success) => {
    if (success) {
      console.log('\n🚀 Servidor iniciado en puerto 3013');
      console.log('\n🔍 Haciendo request a /api/test...');

      setTimeout(async () => {
        try {
          await fetch('http://localhost:3013/api/test');
          console.log('\n✅ Request completado');
        } catch (error) {
          console.error('❌ Error:', error.message);
        }
        process.exit(0);
      }, 500);
    }
  });
}

debugMiddlewareOrder();