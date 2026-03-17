# @voltrix/events

Typed event bus with priority, wildcards, middleware pipeline, and pluggable transport for the Voltrix framework.

## Installation

```bash
pnpm add @voltrix/events reflect-metadata
```

Your `tsconfig.json` must enable decorator metadata:

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

## Quick Start

```typescript
import 'reflect-metadata';
import { EventBus } from '@voltrix/events';

// Define your event map — all events are typed end-to-end
interface AppEvents {
  'user.created': { id: string; email: string };
  'order.completed': { orderId: string; total: number };
  'payment.failed': { orderId: string; reason: string };
}

const bus = new EventBus<AppEvents>();

bus.on('user.created', ({ id, email }) => {
  console.log(`New user ${id}: ${email}`);
});

await bus.emit('user.created', { id: '1', email: 'a@b.com' }); // ✅
await bus.emit('user.created', { id: '1' });                    // ❌ TS error: missing email
await bus.emit('user.CREATED', { id: '1', email: '' });         // ❌ TS error: unknown event
```

## EventBus

### `on(event, handler, options?)`

Register a handler. Returns an unsubscribe function.

```typescript
const unsub = bus.on('user.created', (payload) => { /* ... */ });

// With options
bus.on('user.created', handler, { priority: 'high', once: false });

// Remove via off()
bus.off('user.created', handler);

// Remove via returned function
unsub();
```

### `once(event, handler)`

Fire the handler exactly once, then auto-remove.

```typescript
bus.once('user.created', (payload) => {
  console.log('fires once:', payload.id);
});
```

### `emit(event, payload)`

Dispatch an event. Awaits all async handlers before resolving.

```typescript
await bus.emit('order.completed', { orderId: 'o1', total: 150 });
```

### `emitBatch(entries)`

Emit multiple events concurrently via `Promise.all`.

```typescript
await bus.emitBatch([
  { event: 'user.created', payload: { id: '1', email: 'a@b.com' } },
  { event: 'order.completed', payload: { orderId: 'o1', total: 50 } },
]);
```

## Priority

Handlers run `high → normal → low` within the same event. Handlers at the same priority run in registration order.

```typescript
bus.on('ping', () => console.log('normal'));         // runs 2nd
bus.on('ping', () => console.log('low'), { priority: 'low' });  // runs 3rd
bus.on('ping', () => console.log('high'), { priority: 'high' }); // runs 1st
```

## Wildcards

### Single-segment `*`

Matches exactly one segment. `user.*` matches `user.created`, `user.deleted`, but not `user.role.changed`.

```typescript
bus.on('user.*', (payload) => {
  console.log('any user event');
});
```

### Multi-segment `**`

Matches zero or more segments. `**.failed` matches `payment.failed`, `auth.service.failed`, etc.

```typescript
const errorBus = new EventBus();
errorBus.on('**.failed', (payload) => {
  console.error('something failed', payload);
});
```

Wildcard patterns are **compiled once** and cached — no regex execution on each emit.

## Middleware

Add cross-cutting concerns to the event pipeline. Middlewares run in insertion order before any handlers.

```typescript
// Logging
bus.use(async (event, payload, next) => {
  const start = Date.now();
  await next();
  console.log(`[${event}] ${Date.now() - start}ms`);
});

// Short-circuit (drop the event)
bus.use(async (event, payload, next) => {
  if (isBlocked(event)) return; // handlers never called
  await next();
});

// Transform payload (not type-safe — use with care)
bus.use(async (event, payload, next) => {
  (payload as any).timestamp = Date.now();
  await next();
});
```

## Decorators

### `@OnEvent(event, options?)`

Mark a method as a listener. The class must be bound to a bus via `bindEventListeners()`.

```typescript
import { OnEvent, bindEventListeners, EventBus } from '@voltrix/events';

class NotificationService {
  @OnEvent('user.created')
  handleCreated(payload: AppEvents['user.created']) {
    console.log('new user:', payload.id);
  }

  @OnEvent('order.completed', { priority: 'high' })
  handleOrder(payload: AppEvents['order.completed']) {
    console.log('order done:', payload.orderId);
  }
}

const bus = new EventBus<AppEvents>();
const svc = new NotificationService();

// Bind all @OnEvent methods to the bus
const unsubs = bindEventListeners(svc, bus);

// Later — remove all listeners
unsubs.forEach((u) => u());
```

### `@EmitEvent(event, options?)`

Intercept the method's return value and emit it as an event payload. The class instance must expose an `eventBus` property.

```typescript
import { EmitEvent, EventBus } from '@voltrix/events';

class UserService {
  constructor(public eventBus: EventBus<AppEvents>) {}

  @EmitEvent('user.created')
  async createUser(dto: { email: string }): Promise<AppEvents['user.created']> {
    const user = { id: crypto.randomUUID(), ...dto };
    return user; // automatically emitted as 'user.created'
  }
}

const bus = new EventBus<AppEvents>();
const svc = new UserService(bus);

bus.on('user.created', ({ id }) => console.log('emitted:', id));

await svc.createUser({ email: 'x@y.com' });
```

Use `transform` to shape the payload before emitting:

```typescript
@EmitEvent('user.created', { transform: (result) => ({ id: (result as any).userId }) })
async create() {
  return { userId: '123', internalField: '...' };
}
```

## Transport

Transports forward events to external systems after local handlers run. Implement `IEventTransport` to add Redis, RabbitMQ, Kafka, etc.

```typescript
import type { IEventTransport, EventMap } from '@voltrix/events';

class RedisTransport<TMap extends EventMap> implements IEventTransport<TMap> {
  async publish<K extends keyof TMap & string>(event: K, payload: TMap[K]) {
    await redis.publish(event, JSON.stringify(payload));
  }

  async connect() { await redis.connect(); }
  async disconnect() { await redis.quit(); }
}

const bus = new EventBus<AppEvents>({
  transport: new RedisTransport(),
});

// Local handlers still run first, then the event is forwarded to Redis
await bus.emit('user.created', { id: '1', email: 'a@b.com' });
```

Swap transports at runtime:

```typescript
bus.setTransport(new KafkaTransport());
```

### `InMemoryTransport`

Useful for wiring two EventBus instances together in the same process, or as a controlled transport in tests.

```typescript
import { InMemoryTransport, EventBus } from '@voltrix/events';

const transport = new InMemoryTransport<AppEvents>();
const busA = new EventBus<AppEvents>({ transport });
const busB = new EventBus<AppEvents>();

// Route transport events into busB
transport.subscribe('user.created', (p) => busB.emit('user.created', p));

// Emitting on busA fires handlers on both buses
await busA.emit('user.created', { id: '1', email: 'a@b.com' });
```

## Introspection

```typescript
bus.listenerCount('user.created') // number of exact handlers
bus.wildcardCount()               // total wildcard handlers across all patterns
bus.eventNames()                  // ['user.created', 'order.completed', ...]
bus.hasListeners('user.created')  // true if any exact or wildcard handler matches
bus.getTransport()                // current transport or undefined
```

## Lifecycle

```typescript
bus.clear('user.created') // remove all handlers for one event
bus.clear()               // remove all handlers and wildcard patterns
bus.dispose()             // clear + disconnect transport
```

## Error Handling

```typescript
import { EventBusError, MaxListenersExceededWarning, TransportError } from '@voltrix/events';
```

| Error | When |
|---|---|
| `MaxListenersExceededWarning` | A single event exceeds `maxListeners` (default 100). Logged as a warning, not thrown. |
| `TransportError` | Thrown by custom transport implementations to signal delivery failures. |
| `EventDispatchError` | Wraps a handler error with the originating event name. |

## Constructor Options

```typescript
const bus = new EventBus<AppEvents>({
  transport: new RedisTransport(),  // optional external transport
  maxListeners: 50,                 // warn threshold per event (default: 100)
  delimiter: ':',                   // wildcard segment delimiter (default: '.')
});
```

## API Reference

### `EventBus<TMap>`

| Method | Description |
|---|---|
| `on(event, handler, opts?)` | Register a handler. Returns unsubscribe fn. |
| `once(event, handler)` | Register a one-shot handler. |
| `off(event, handler)` | Remove a specific handler. |
| `emit(event, payload)` | Dispatch an event. Awaits all async handlers. |
| `emitBatch(entries[])` | Emit multiple events concurrently. |
| `use(middleware)` | Add a middleware to the pipeline. |
| `setTransport(transport)` | Replace the external transport. |
| `getTransport()` | Return the current transport or `undefined`. |
| `listenerCount(event)` | Number of exact handlers for an event. |
| `wildcardCount()` | Total wildcard handlers across all patterns. |
| `eventNames()` | Array of registered event names. |
| `hasListeners(event)` | True if any handler (exact or wildcard) matches. |
| `clear(event?)` | Remove all handlers, or only for one event. |
| `dispose()` | Clear all state and disconnect transport. |

### `IEventTransport<TMap>`

| Method | Required | Description |
|---|---|---|
| `publish(event, payload)` | ✅ | Forward event to external system. |
| `subscribe(event, handler)` | optional | Receive incoming external events. |
| `unsubscribe(event, handler)` | optional | Remove external subscription. |
| `connect()` | optional | Initialize transport connection. |
| `disconnect()` | optional | Tear down transport connection. |
| `clear()` | optional | Remove all subscriptions. |

## License

MIT
