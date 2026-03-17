/**
 * 🚀 Benchmark Framework Interface
 * Interfaz estándar para todos los frameworks
 */

/**
 * Interfaz estándar que debe implementar cada adaptador de framework
 */
export class FrameworkAdapter {
  constructor(name, version, backend) {
    this.name = name;
    this.version = version;
    this.backend = backend;
    this.server = null;
    this.stats = {
      requestCount: 0,
      startTime: Date.now()
    };
  }

  /**
   * Crear y iniciar el servidor
   * @param {number} port - Puerto donde iniciar el servidor
   * @param {object} config - Configuración adicional
   * @returns {Promise<void>}
   */
  async start(port, config = {}) {
    throw new Error('start() method must be implemented by adapter');
  }

  /**
   * Detener el servidor
   * @returns {Promise<void>}
   */
  async stop() {
    throw new Error('stop() method must be implemented by adapter');
  }

  /**
   * Obtener la URL base para las pruebas
   * @param {number} port - Puerto del servidor
   * @returns {string}
   */
  getTestUrl(port) {
    return `http://localhost:${port}/`;
  }

  /**
   * Obtener información del framework
   * @returns {object}
   */
  getInfo() {
    return {
      name: this.name,
      version: this.version,
      backend: this.backend,
      stats: {
        ...this.stats,
        uptime: Date.now() - this.stats.startTime
      }
    };
  }

  /**
   * Incrementar contador de requests (llamado por middleware)
   */
  incrementRequestCount() {
    this.stats.requestCount++;
  }
}

/**
 * Configuración estándar del benchmark
 */
export const BENCHMARK_CONFIG = {
  requests: 1000,
  timeout: 3000,
  concurrency: 1, // Sequential por defecto
  warmupRequests: 10
};

/**
 * Respuesta estándar JSON para todas las pruebas
 */
export const STANDARD_RESPONSE = {
  message: 'Hello World!',
  framework: null, // Se setea dinámicamente
  timestamp: null   // Se setea dinámicamente
};