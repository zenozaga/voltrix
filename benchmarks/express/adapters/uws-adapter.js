/**
 * 🚀 uWebSockets.js Adapter
 * Adaptador para uWebSockets.js usando la interfaz estándar
 */

import uWS from 'uWebSockets.js';
import { FrameworkAdapter, STANDARD_RESPONSE } from '../framework-interface.js';

export class UWSAdapter extends FrameworkAdapter {
  constructor() {
    super('uWebSockets.js', '20.44.0', 'uWebSockets.js');
    this.app = null;
    this.listenSocket = null;
  }

  async start(port, config = {}) {
    this.app = uWS.App();
    
    // Middleware simulado para contar requests
    const countRequest = () => {
      this.incrementRequestCount();
    };

    // Ruta estándar de prueba
    this.app.get('/', (res, req) => {
      countRequest();
      
      const response = {
        ...STANDARD_RESPONSE,
        framework: this.name,
        timestamp: Date.now()
      };
      
      res.writeHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(response));
    });

    // Rutas adicionales
    this.app.get('/ping', (res, req) => {
      countRequest();
      
      const response = { pong: true, timestamp: Date.now() };
      
      res.writeHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(response));
    });

    this.app.get('/users/:id', (res, req) => {
      countRequest();
      
      const id = req.getParameter(0); // uWS parameter access
      const response = {
        id: id,
        name: 'Test User',
        framework: this.name
      };
      
      res.writeHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(response));
    });

    return new Promise((resolve, reject) => {
      this.app.listen(port, (listenSocket) => {
        console.log('Listening on port', port);
        if (listenSocket) {
          this.listenSocket = listenSocket;
          resolve();
        } else {
          reject(new Error('Failed to listen on port ' + port));
        }
      });
    });
  }

  async stop() {
    if (this.listenSocket) {
      uWS.us_listen_socket_close(this.listenSocket);
      this.listenSocket = null;
    }
  }
}