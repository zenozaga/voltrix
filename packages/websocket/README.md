# @voltrix/websocket

High-performance, programmatic-first and decorator-driven real-time WebSocket suite natively optimized for `uWebSockets.js` and `@voltrix/server`.

Voltrix Sockets offers extreme event dispatching speeds, zero-allocation message hot paths, pluggable clustered messaging adapters, and early HTTP upgrade handshakes.

---

## 🏗️ Core Architectural Features

1. **`Programmatic-First`**: Instanciate adapters, define event message handlers, and execute middlewares purely functionally without decorators or DI container dependencies.
2. **`HTTP Pre-Upgrade Handshakes`**: Perform asynchronous token, database, or cookie validation in the HTTP upgrade phase. Reject invalid connections with standard HTTP codes (`401 Unauthorized`) before allocating TCP WS handles.
3. **`Stack-Allocation Safeguard`**: Clones stack-allocated uWS request structs synchronously into heap-allocated `HeapRequest` objects, enabling safe, crash-free asynchronous database and cache checks in handshakes.
4. **`Pluggable Pub/Sub Engine`**:
   * **`MemoryEngine`**: Employs uWS native C++ pub/sub for maximum local single-node throughput and near-zero memory footprint.
   * **`RedisEngine`**: Syncs room and user topics dynamically across a cluster of multiple Voltrix server instances.
5. **`Onion-Style Event Pipelines`**: Koa-like event middleware pipeline allowing data interceptors, payload validation (Zod/TypeBox schemas), and short-circuiting.

---

## 📦 Installation

```bash
npm install @voltrix/websocket ioredis ws
```

---

## 🚀 Usage Guide

### 1. Programmatic Setup (Functional & Performance-First)
Build, manage, and test WebSocket connections directly using clean functional code:

```typescript
import { UwsWebSocketAdapter } from '@voltrix/websocket/adapters';
import { MemoryEngine } from '@voltrix/websocket/pubsub';
import { WsPipeline } from '@voltrix/websocket/pipeline';

// 1. Instantiate the Adapter on Port 8080
const adapter = new UwsWebSocketAdapter();
const server = adapter.create(8080, {
  // Safe asynchronous Handshake Auth Guard
  async onUpgrade(req, res) {
    const token = req.query.token;
    if (!token || token !== 'my-secret-token') {
      res.status(401).json({ error: 'Unauthorized', message: 'Invalid handshake token' });
      return false; // Rejects handshake immediately
    }
    return { userId: 'user_123', roles: ['admin'] }; // Resolved user context
  }
});

// 2. Define Onion Pipeline for Message Interception
const pipeline = new WsPipeline();

// Event validation middleware
pipeline.use(async (ctx, next) => {
  if (ctx.event === 'admin:action' && !ctx.client.user?.roles.includes('admin')) {
    ctx.client.send(JSON.stringify({ error: 'Forbidden' }));
    return; // Short-circuit
  }
  ctx.payload.processedAt = Date.now(); // Mutate payload
  await next();
});

// 3. Bind Connection events and pipelines
adapter.bindClientConnect(server, (socket) => {
  console.log(`Socket established: ${socket.id}, User Context:`, socket.user);
  
  // Subscribe socket to a private topic for direct messages
  socket.subscribe(`user:${socket.user.userId}`);

  adapter.bindMessageHandlers(socket, [
    {
      event: 'chat:message',
      handler: async (client, data) => {
        // Run message execution through the pipeline
        await pipeline.run(client, 'chat:message', data, async (c, payload) => {
          // Publish message globally to a user topic room
          c.publish(`user:${payload.targetUserId}`, {
            from: c.user.userId,
            text: payload.text,
            time: payload.processedAt
          });
        });
      }
    }
  ]);
});
```

---

### 2. Decorator Setup (DX Gateway Controllers)
Declare and compile WebSocket gateways using standard TypeScript decorators:

```typescript
import { Injectable } from '@voltrix/injector';
import { 
  WebSocketGateway, 
  SubscribeMessage, 
  ConnectedSocket, 
  MessageBody,
  OnConnect,
  WsSocket
} from '@voltrix/websocket';

// 1. Define Handshake Auth Guard as a DI Provider
@Injectable()
export class WsAuthGuard {
  async canActivate(context: any): Promise<boolean> {
    const req = context.getRequest();
    const token = req.headers['authorization'] || req.query.token;
    
    if (token === 'super-token') {
      context.setUser({ id: 'user_456', username: 'john_doe' });
      return true;
    }
    return false;
  }
}

// 2. Declare Class Gateway
@WebSocketGateway({
  path: '/gateway-ws',
  guard: WsAuthGuard // Auto-evaluates in the upgrade handshake
})
export class NotificationGateway {

  @OnConnect()
  onConnect(@ConnectedSocket() socket: WsSocket) {
    // Subscribe to a private room
    socket.subscribe(`user:${socket.user.id}`);
  }

  @SubscribeMessage('send_alert')
  async handleAlert(
    @ConnectedSocket() socket: WsSocket,
    @MessageBody() payload: { text: string; targetId: string }
  ) {
    // Deliver message natively to the targeted room
    socket.publish(`user:${payload.targetId}`, JSON.stringify({
      alert: payload.text,
      sender: socket.user.username
    }));
  }
}
```

```typescript
// 3. Compile Gateway using the Processor at startup
import { DIContainer } from '@voltrix/injector';
import { WebSocketProcessor } from '@voltrix/websocket';

const container = new DIContainer();
// WebSocketProcessor automatically scans, compiles routes, and connects to DI container
WebSocketProcessor.process(container, undefined, 8080);
```
