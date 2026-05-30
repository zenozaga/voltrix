import type { IPubSubEngine, WsSocket } from '../types/index.js';

/**
 * 📡 In-Memory Pub/Sub Engine using native C++ uWebSockets.js capabilities.
 * Delivers extreme performance and near-zero memory footprint.
 */
export class MemoryEngine implements IPubSubEngine {
  /**
   * @param app The raw uWS TemplatedApp instance.
   */
  constructor(private readonly app: any) {}

  subscribe(client: WsSocket, topic: string): void {
    client.subscribe(topic);
  }

  unsubscribe(client: WsSocket, topic: string): void {
    client.unsubscribe(topic);
  }

  publish(topic: string, message: any, isBinary?: boolean): void {
    const payload = typeof message === 'string' ? message : JSON.stringify(message);
    this.app.publish(topic, payload, isBinary ?? false);
  }

  broadcast(message: any, isBinary?: boolean): void {
    // Standardized global room for broadcasts
    const payload = typeof message === 'string' ? message : JSON.stringify(message);
    this.app.publish('global', payload, isBinary ?? false);
  }
}
