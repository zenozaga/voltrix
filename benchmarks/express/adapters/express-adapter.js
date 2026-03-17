/**
 * 🟢 Express.js Adapter
 * Adaptador para Express.js usando la interfaz estándar
 */

import express from 'express';
import { FrameworkAdapter, STANDARD_RESPONSE } from '../framework-interface.js';

export class ExpressAdapter extends FrameworkAdapter {
  constructor() {
    super('Express.js', '4.19.2', 'Node.js HTTP');
    this.app = null;
    this.serverInstance = null;
  }

  async start(port, config = {}) {
    this.app = express();
    
    // Middleware para contar requests
    this.app.use((req, res, next) => {
      this.incrementRequestCount();
      next();
    });

    // Ruta estándar de prueba
    this.app.get('/', (req, res) => {
      res.json({
        ...STANDARD_RESPONSE,
        framework: this.name,
        timestamp: Date.now()
      });
    });

    // Rutas adicionales para pruebas variadas
    this.app.get('/ping', (req, res) => {
      res.json({ pong: true, timestamp: Date.now() });
    });

    this.app.get('/users/:id', (req, res) => {
      res.json({
        id: req.params.id,
        name: 'Test User',
        framework: this.name
      });
    });

    return new Promise((resolve, reject) => {
      this.serverInstance = this.app.listen(port, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  async stop() {
    if (this.serverInstance) {
      return new Promise((resolve) => {
        this.serverInstance.close(() => {
          resolve();
        });
      });
    }
  }
}