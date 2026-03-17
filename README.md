# Voltrix

Ultra-fast Node.js HTTP framework built on [uWebSockets.js](https://github.com/uNetworking/uWebSockets.js). Express-compatible API with decorator support, dependency injection, and OpenAPI generation — without sacrificing performance.

## Benchmark

Single-core · 100 concurrent connections · autocannon · loopback:

| Scenario | Pure Node | uWS raw | Voltrix | **@voltrix/server** |
|---|---|---|---|---|
| GET / | 80.6k | 80.1k | 84.1k | **85.3k** req/s |
| GET /users/:id — param | 80.1k | 86.3k | 90.8k | **91.8k** req/s |
| GET /deep/99 — 100 routes | 79.0k | 83.8k | 87.8k | **90.9k** req/s |
| GET /mw — 20 middlewares | 82.3k | 80.0k | 86.9k | **88.7k** req/s |
| POST /echo — JSON body | 68.5k | 88.0k | 94.6k | **92.1k** req/s |
| POST /form — URL-encoded | 59.5k | 93.5k | 92.0k | **85.4k** req/s |

Multi-core · 24 threads · SO_REUSEPORT · loopback:

| Scenario | Pure Cluster | uWS MT | **@voltrix/server MT** |
|---|---|---|---|
| GET /ping — JSON | 74.7k | 83.9k | **90.3k** req/s |
| GET /mw — 20 middlewares | 73.4k | 79.7k | **90.3k** req/s |
| POST /echo — JSON body | 61.7k | 89.8k | **91.7k** req/s |
| POST /form — URL-encoded | 80.6k | 85.0k | **90.1k** req/s |

> `@voltrix/server` outperforms raw uWS MT on 7/8 scenarios. Framework overhead (RadixTree + hooks + CtxPool) is invisible at scale.

**TCP ceiling (raw Node.js, loopback):** ~148k req/s single-thread · ~3.5M req/s theoretical at 24 threads.
`@voltrix/server` operates at ~60% of the raw TCP ceiling — the remaining 40% is the honest cost of HTTP parsing, routing, and JSON serialization.

## Packages

| Package | Description |
|---|---|
| [`@voltrix/server`](packages/server) | Ultra-fast HTTP server core — unified ctx, pre-classified hooks, radix tree, object pool, plugins |
| [`@voltrix/express`](packages/express) | Express-compatible adapter on top of `@voltrix/server` |
| [`@voltrix/decorator`](packages/decorator) | TypeScript decorators for controllers, routes, and params |
| [`@voltrix/injector`](packages/injector) | Dependency injection container with `reflect-metadata` |
| [`@voltrix/swagger`](packages/swagger) | OpenAPI 3.0 spec generator — programmatic and decorator APIs |
| [`@voltrix/events`](packages/events) | Typed event bus with priority, wildcards, middleware, and pluggable transport |
| [`@voltrix/core`](packages/core) | Shared types and interfaces |

## Quick Start — `@voltrix/server`

```bash
npm install @voltrix/server
```

```ts
import { createServer } from '@voltrix/server';

const server = createServer();

// Global hooks
server.onRequest((ctx) => { ctx.locals.startAt = Date.now(); });
server.onResponse((ctx) => { console.log(`${ctx.method} ${ctx.url}`); });
server.onError((ctx, err) => {
  ctx.status(500).json({ error: String(err) });
});

// Custom 404
server.notFound((ctx) => {
  ctx.status(404).json({ error: `${ctx.method} ${ctx.url} not found` });
});

// Routes
server.get('/ping', (ctx) => ctx.json({ pong: true }));

server.get('/users/:id', (ctx) => {
  return { id: ctx.params.id };   // auto-serialized
});

server.post('/echo', async (ctx) => {
  const body = await ctx.readJson();
  ctx.json(body);
});

await server.listen({ port: 3000 });
console.log('Listening on http://localhost:3000');
```

### Sub-routers

```ts
import { createServer, createRouter } from '@voltrix/server';

const users = createRouter('/users');

users.get('/', (ctx) => ctx.json({ users: [] }));
users.get('/:id', (ctx) => ctx.json({ id: ctx.params.id }))
  .meta('openapi', { summary: 'Get user by ID', tags: ['Users'] });

users.post('/', (ctx) => ctx.status(201).json({ created: true }))
  .onRequest((ctx) => {
    if (!ctx.header('authorization')) throw new HttpError(401, 'Unauthorized');
  });

const server = createServer();
server.use(users);
await server.listen({ port: 3000 });
```

### Plugins

```ts
server.plugin(async (instance) => {
  // Decorate ctx at prototype level — zero per-request cost
  instance.decorateCtx('requestId', '');

  instance.onRequest((ctx) => {
    ctx.locals.requestId = crypto.randomUUID();
  });
});
```

### Route introspection

```ts
// All routes with OpenAPI metadata
const docs = server.routes().byMeta('openapi');

// JSON-safe snapshot for logging/tooling
console.log(server.tree());
```

## Quick Start — Express adapter

```bash
npm install @voltrix/express
```

```ts
import voltrix from '@voltrix/express';

const app = voltrix();

app.get('/ping', (_req, res) => {
  res.json({ pong: true });
});

app.get('/users/:id', (req, res) => {
  res.json({ id: req.getParam('id') });
});

app.post('/echo', async (req, res) => {
  const body = await req.json();
  res.json(body);
});

await app.listen(3000);
console.log('Listening on http://localhost:3000');
```

## Decorator API

```bash
npm install @voltrix/express @voltrix/decorator reflect-metadata
```

```ts
import 'reflect-metadata';
import { VoltrixApp, createVoltrix, GET, POST, Body, Query } from '@voltrix/decorator';

@VoltrixApp({ port: 3000 })
class Application {
  @GET('/api/health')
  async healthCheck() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @GET('/api/users')
  async getUsers(@Query('limit') limit = 10) {
    return { users: [], total: 0, limit };
  }

  @POST('/api/users')
  async createUser(@Body() userData: { name: string; email: string }) {
    return { success: true, user: { id: 1, ...userData } };
  }
}
```

```ts
const app = await createVoltrix(Application, { autoStart: true, port: 3000 });
```

Controllers can be grouped under a prefix using `@Controller`:

```ts
import { Controller, GET } from '@voltrix/decorator';

@Controller('v1')
class UserController {
  @GET('/users')
  async getUsers() {}
}
// Registers: GET /v1/users
```

## OpenAPI

```bash
npm install @voltrix/swagger
```

```ts
import { createRouter } from '@voltrix/express';
import { generateFromRouter, swaggerUi } from '@voltrix/swagger';

const router = createRouter('/v1');

router.get('/users', handler).meta({
  summary: 'List users',
  tags: ['Users']
});

const spec = generateFromRouter(router, { title: 'My API', version: '1.0.0' });

app.use(swaggerUi(spec, '/docs'));
```

## Requirements

- Node.js >= 18.0.0 (LTS: 20, 22)
- TypeScript >= 4.5 (for decorators)
- Ubuntu 22.04+ / macOS / Windows

## License

MIT
