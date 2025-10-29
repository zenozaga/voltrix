/**
 * 🔷 Hapi.js Adapter
 * Adaptador para Hapi.js usando la interfaz estándar
 */

import Hapi from '@hapi/hapi';
import { FrameworkAdapter, STANDARD_RESPONSE } from '../framework-interface.js';

export class HapiAdapter extends FrameworkAdapter {
  constructor() {
    super('Hapi.js', '21.3.2', 'Node.js HTTP');
    this.server = null;
  }

  async start(port, config = {}) {
    this.server = Hapi.server({
      port: port,
      host: '0.0.0.0'
    });

    // Extension para contar requests
    this.server.ext('onRequest', (request, h) => {
      this.incrementRequestCount();
      return h.continue;
    });

    // Ruta estándar de prueba
    this.server.route({
      method: 'GET',
      path: '/',
      handler: (request, h) => {
        return {
          ...STANDARD_RESPONSE,
          framework: this.name,
          timestamp: Date.now()
        };
      }
    });

    // Rutas adicionales
    this.server.route({
      method: 'GET',
      path: '/ping',
      handler: (request, h) => {
        return { pong: true, timestamp: Date.now() };
      }
    });

    this.server.route({
      method: 'GET',
      path: '/users/{id}',
      handler: (request, h) => {
        return {
          id: request.params.id,
          name: 'Test User',
          framework: this.name
        };
      }
    });

    await this.server.start();
  }

  async stop() {
    if (this.server) {
      await this.server.stop();
    }
  }
}