/**
 * 🚀 Voltrix Adapter
 * Adaptador para Voltrix usando la interfaz estándar
 */

import { App } from '../../../packages/express/dist/index.js';
import { FrameworkAdapter, STANDARD_RESPONSE } from '../framework-interface.js';

export class VoltrixAdapter extends FrameworkAdapter {
  constructor() {
    super('Voltrix', '1.0.0', 'uWebSockets.js + Prefix Tree + LRU Cache');
    this.app = null;
  }

  async start(port, config = {}) {
    this.app = new App();
    
    // Middleware para contar requests (sin usar setHeader que causa problemas)
    this.app.use((req, res, next) => {
      this.incrementRequestCount();
      next();
    });

    // Ruta estándar de prueba
    this.app.get('/', (req, res) => {
      res.json({
        ...STANDARD_RESPONSE,
        framework: this.name,
        timestamp: Date.now(),
        prefixTree: true, // Prefix Tree (Trie) for O(m) matching
        lruCache: true // LRU cache for dynamic routes
      });
    });

    // Rutas adicionales para mostrar Ultra-Fast Router
    this.app.get('/ping', (req, res) => {
      res.json({ 
        pong: true, 
        timestamp: Date.now(),
        framework: this.name
      });
    });

    // Ruta parameterizada (se convierte automáticamente a Direct Action)
    this.app.get('/users/:id', (req, res) => {
      res.json({
        id: req.params.id,
        name: 'Test User',
        framework: this.name,
        routeType: 'Direct Action O(1)',
        params: req.params
      });
    });

    // Ruta POST para pruebas completas
    this.app.post('/users', (req, res) => {
      res.status(201).json({
        id: Math.floor(Math.random() * 1000),
        message: 'User created',
        framework: this.name,
        method: 'POST'
      });
    });

    return new Promise((resolve, reject) => {
      try {
        this.app.listen(port, (success) => {
          if (success) {
            resolve();
          } else {
            reject(new Error(`Failed to start Voltrix server on port ${port}`));
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  async stop() {
    if (this.app) {
      try {
        this.app.close();
        // Pequeña pausa para asegurar que el puerto se libere
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        // Ignorar errores de cierre
      }
    }
  }

  getInfo() {
    const baseInfo = super.getInfo();
    
    // Información adicional específica de Voltrix
    return {
      ...baseInfo,
      features: [
        'Ultra-Fast O(1) Router',
        'uWebSockets.js Backend',
        'Express API Compatible',
        'Auto Parameter Routing'
      ],
      directActions: this.app?.router?.directActionCount || 0,
      routeOptimization: 'HashMap-based'
    };
  }
}