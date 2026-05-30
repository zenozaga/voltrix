import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import WebSocket from 'ws';
import Redis from 'ioredis';
import { DIContainer } from '@voltrix/injector';
import { UwsWebSocketAdapter } from '../src/adapters/uws-adapter.js';
import { MemoryEngine, RedisEngine } from '../src/pubsub/index.js';
import { WsPipeline } from '../src/pipeline/index.js';
import { WebSocketGateway, SubscribeMessage, ConnectedSocket, MessageBody, OnConnect } from '../src/decorators/index.js';
import { WebSocketProcessor } from '../src/processors/websocket.processor.js';

describe('Voltrix WebSocket Package Integration', () => {
  let uwsApp: any;
  let redisOnline = false;

  beforeAll(async () => {
    // Detect if a local Redis is online on port 6379 for clustered tests
    const client = new Redis({ host: '127.0.0.1', port: 6379, maxRetriesPerRequest: 1 });
    try {
      await client.ping();
      redisOnline = true;
    } catch {
      redisOnline = false;
    } finally {
      client.disconnect();
    }
  });

  describe('Programmatic Adapter & Handshake Guards', () => {
    it('should reject handshake with 401 when token is invalid', async () => {
      const adapter = new UwsWebSocketAdapter();
      const server = adapter.create(9011, {
        async onUpgrade(req, res) {
          const token = req.query.token;
          if (token !== 'secure-pass') {
            return false; // Handshake rejected
          }
          return { id: 'admin_1' };
        }
      });

      // Try connecting with invalid token
      const wsClient = new WebSocket('ws://127.0.0.1:9011/ws?token=wrong');

      const failedUpgrade = await new Promise<boolean>((resolve) => {
        wsClient.on('unexpected-response', (req, res) => {
          if (res.statusCode === 401) {
            resolve(true);
          }
        });
        wsClient.on('open', () => resolve(false));
        wsClient.on('error', () => {}); // Consumes connection failures safely
      });

      try {
        wsClient.close();
      } catch {
        // Safe wrap
      }
      expect(failedUpgrade).toBe(true);
    });

    it('should successfully establish connection and pass user context when token is valid', async () => {
      const adapter = new UwsWebSocketAdapter();
      const server = adapter.create(9012, {
        async onUpgrade(req, res) {
          const token = req.query.token;
          if (token !== 'secure-pass') return false;
          return { id: 'user_99', roles: ['admin'] };
        }
      });

      let resolvedUser: any = null;
      adapter.bindClientConnect(server, (socket) => {
        resolvedUser = socket.user;
      });

      const wsClient = new WebSocket('ws://127.0.0.1:9012/ws?token=secure-pass');

      const opened = await new Promise<boolean>((resolve) => {
        wsClient.on('open', () => resolve(true));
        wsClient.on('error', () => resolve(false));
      });

      try {
        wsClient.close();
      } catch {
        // Safe wrap
      }
      expect(opened).toBe(true);
      expect(resolvedUser).toBeDefined();
      expect(resolvedUser.id).toBe('user_99');
      expect(resolvedUser.roles).toContain('admin');
    });
  });

  describe('Programmatic Pipeline & Interceptors', () => {
    it('should execute message pipeline, apply middlewares, and dispatch event', async () => {
      const adapter = new UwsWebSocketAdapter();
      const server = adapter.create(9013);

      const pipeline = new WsPipeline();
      const executionChain: string[] = [];

      // 1. Add Onion-model middleware
      pipeline.use(async (ctx, next) => {
        executionChain.push('middleware_start');
        ctx.payload.text = ctx.payload.text.toUpperCase(); // Mutate payload
        await next();
        executionChain.push('middleware_end');
      });

      let finalPayload: any = null;
      adapter.bindClientConnect(server, (socket) => {
        adapter.bindMessageHandlers(socket, [
          {
            event: 'test_event',
            handler: async (client, data) => {
              await pipeline.run(client, 'test_event', data, async (c, payload) => {
                finalPayload = payload;
                executionChain.push('final_handler');
              });
            }
          }
        ]);
      });

      const wsClient = new WebSocket('ws://127.0.0.1:9013/ws');

      await new Promise<void>((resolve) => wsClient.on('open', resolve));

      // Send normalized JSON protocol packet
      wsClient.send(JSON.stringify({ event: 'test_event', data: { text: 'hello' } }));

      // Wait a moment for async network loops to cycle
      await new Promise((resolve) => setTimeout(resolve, 100));

      try {
        wsClient.close();
      } catch {
        // Safe wrap
      }

      expect(finalPayload).toEqual({ text: 'HELLO' });
      expect(executionChain).toEqual(['middleware_start', 'final_handler', 'middleware_end']);
    });
  });

  describe('Pub/Sub Engines', () => {
    it('should broadcast message locally in-memory using C++ pub/sub', async () => {
      const adapter = new UwsWebSocketAdapter();
      const server = adapter.create(9014);
      const pubsub = new MemoryEngine(server);

      const clientMessages: string[] = [];

      adapter.bindClientConnect(server, (socket) => {
        pubsub.subscribe(socket, 'chat:lobby');
      });

      const wsClient1 = new WebSocket('ws://127.0.0.1:9014/ws');
      const wsClient2 = new WebSocket('ws://127.0.0.1:9014/ws');

      await Promise.all([
        new Promise((resolve) => wsClient1.on('open', resolve)),
        new Promise((resolve) => wsClient2.on('open', resolve))
      ]);

      wsClient1.on('message', (msg) => clientMessages.push(msg.toString()));
      wsClient2.on('message', (msg) => clientMessages.push(msg.toString()));

      // Publish broadcast message to C++ engine
      pubsub.publish('chat:lobby', 'Welcome to Voltrix Sockets');

      await new Promise((resolve) => setTimeout(resolve, 100));

      try {
        wsClient1.close();
        wsClient2.close();
      } catch {
        // Safe wrap
      }

      expect(clientMessages).toHaveLength(2);
      expect(clientMessages[0]).toBe('Welcome to Voltrix Sockets');
      expect(clientMessages[1]).toBe('Welcome to Voltrix Sockets');
    });

    it('should bridge distributed messages via Redis Pub/Sub', async () => {
      if (!redisOnline) {
        console.log('⚠️ Redis offline on 127.0.0.1:6379. Skipping RedisEngine integration test.');
        return;
      }

      const adapter = new UwsWebSocketAdapter();
      const server = adapter.create(9015);
      const pubsub = new RedisEngine(server, 'redis://127.0.0.1:6379');

      const messages: string[] = [];

      adapter.bindClientConnect(server, (socket) => {
        pubsub.subscribe(socket, 'news:alerts');
      });

      const wsClient = new WebSocket('ws://127.0.0.1:9015/ws');
      await new Promise((resolve) => wsClient.on('open', resolve));

      wsClient.on('message', (msg) => messages.push(msg.toString()));

      // Publish distributed message to Redis Pub/Sub
      await pubsub.publish('news:alerts', 'Emergency System Alert');

      await new Promise((resolve) => setTimeout(resolve, 150));

      try {
        wsClient.close();
      } catch {
        // Safe wrap
      }
      await pubsub.close();

      expect(messages).toContain('Emergency System Alert');
    });
  });

  describe('Decorator-Driven Gateway & Discovery Compiler', () => {
    it('should scan, compile, and run decorated gateway from DI container', async () => {
      const container = new DIContainer();

      // Guard class for tests
      class TestWsGuard {
        canActivate(ctx: any) {
          const token = ctx.getRequest().query.token;
          if (token === 'valid-user') {
            ctx.setUser({ id: 'decorator_user' });
            return true;
          }
          return false;
        }
      }
      container.addProvider(TestWsGuard);

      let onConnectTriggered = false;
      let receivedText = '';

      @WebSocketGateway({ path: '/app-ws', guard: TestWsGuard })
      class TestGateway {
        @OnConnect()
        connect(@ConnectedSocket() socket: any) {
          onConnectTriggered = true;
          socket.subscribe('news');
        }

        @SubscribeMessage('ping')
        ping(@ConnectedSocket() socket: any, @MessageBody() body: any) {
          receivedText = body.message;
        }
      }
      container.addProvider(TestGateway);

      // Compile Gateway in Standalone mode (port 9016)
      WebSocketProcessor.process(container, undefined, 9016);

      const wsClient = new WebSocket('ws://127.0.0.1:9016/app-ws?token=valid-user');

      await new Promise<void>((resolve) => wsClient.on('open', () => resolve()));

      wsClient.send(JSON.stringify({ event: 'ping', data: { message: 'hello from decorator' } }));

      await new Promise((resolve) => setTimeout(resolve, 150));

      try {
        wsClient.close();
      } catch {
        // Safe wrap
      }

      expect(onConnectTriggered).toBe(true);
      expect(receivedText).toBe('hello from decorator');
    });
  });
});
