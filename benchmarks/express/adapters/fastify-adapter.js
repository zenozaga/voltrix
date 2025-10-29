/**
 * ⚡ Fastify Adapter
 * Adaptador para Fastify usando la interfaz estándar
 */

import Fastify from 'fastify';
import { FrameworkAdapter, STANDARD_RESPONSE } from '../framework-interface.js';

export class FastifyAdapter extends FrameworkAdapter {
  constructor() {
    super('Fastify', '4.24.3', 'Node.js HTTP');
    this.app = null;
  }

  async start(port, config = {}) {
    this.app = Fastify({ 
      logger: false,
      trustProxy: true
    });
    
    // Hook para contar requests
    this.app.addHook('onRequest', async (request, reply) => {
      this.incrementRequestCount();
    });

    // Ruta estándar de prueba
    this.app.get('/', async (request, reply) => {
      return {
        ...STANDARD_RESPONSE,
        framework: this.name,
        timestamp: Date.now()
      };
    });

    // Rutas adicionales
    this.app.get('/ping', async (request, reply) => {
      return { pong: true, timestamp: Date.now() };
    });

    this.app.get('/users/:id', async (request, reply) => {
      return {
        id: request.params.id,
        name: 'Test User',
        framework: this.name
      };
    });

    await this.app.listen({ port, host: '0.0.0.0' });
  }

  async stop() {
    if (this.app) {
      await this.app.close();
    }
  }
}