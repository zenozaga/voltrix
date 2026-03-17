# Voltrix

Ultra-fast Node.js HTTP framework built on [uWebSockets.js](https://github.com/uNetworking/uWebSockets.js). Express-compatible API with decorator support, dependency injection, and OpenAPI generation — without sacrificing performance.

## Benchmark

Single-core, 100 concurrent connections, autocannon, loopback:

| Scenario | Pure Node | uWS raw | **Voltrix** |
|---|---|---|---|
| GET / | 88k | 88k | **94k** req/s |
| GET /users/:id | 85k | 93k | **97k** req/s |
| GET /deep/99 (100 routes) | 85k | 91k | **97k** req/s |
| GET /mw (20 middlewares) | 87k | 90k | **95k** req/s |
| POST /echo JSON | 74k | 94k | **99k** req/s |
| POST /form URL-encoded | 63k | 99k | **95k** req/s |

> Voltrix outperforms raw uWS on GET routes. uWS wins slightly on URL-encoded body due to zero framework overhead.

## Packages

| Package | Description |
|---|---|
| [`@voltrix/express`](packages/express) | Core HTTP server — routing, middleware, request/response |
| [`@voltrix/decorator`](packages/decorator) | TypeScript decorators for controllers, routes, and params |
| [`@voltrix/injector`](packages/injector) | Dependency injection container with `reflect-metadata` |
| [`@voltrix/swagger`](packages/swagger) | OpenAPI 3.0 spec generator — programmatic and decorator APIs |
| [`@voltrix/core`](packages/core) | Shared types and interfaces |

## Quick Start

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
import { VoltrixApp, createVoltrix, GET, POST, Body, Query, Params } from '@voltrix/decorator';

@VoltrixApp({
  port: 3000,
  cors: { origin: '*' }
})
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
const app = await createVoltrix(Application, {
  autoStart: true,
  port: 3000,
  host: 'localhost'
});
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

The architecture follows `App -> Module -> Controller -> Function`. The full application lifecycle is configurable via `@OnReady`, `@OnStart`, `@OnStop`, and `@OnError` hooks on the application class.

## OpenAPI

```bash
npm install @voltrix/swagger
```

### Programmatic (router-based)

Annotate routes with `.meta()` and pass the router to `generateFromRouter`:

```ts
import { createRouter } from '@voltrix/express';
import { generateFromRouter, swaggerUi } from '@voltrix/swagger';

const router = createRouter('/v1');

router.get('/users', handler).meta({
  summary: 'List users',
  tags: ['Users']
});

router.post('/users/:id', handler).meta({
  summary: 'Update user',
  tags: ['Users'],
  responses: {
    200: { description: 'Updated' }
  }
});

const spec = generateFromRouter(router, {
  title: 'My API',
  version: '1.0.0'
});

// Serve Swagger UI at /docs
app.use(swaggerUi(spec, '/docs'));
```

### Decorator-based (tree)

When using the decorator API, pass the resolved `AppTree` to `generateFromTree`:

```ts
import { generateFromTree, swaggerUi } from '@voltrix/swagger';

const spec = generateFromTree(appTree, {
  title: 'My API',
  version: '1.0.0'
});

app.use(swaggerUi(spec, '/docs'));
```

Both generators produce an OpenAPI 3.0 document. Routes can be excluded or namespaced via their metadata (`exclude: true`, `namespace: 'admin'`), and the `namespace` option on the generator call filters to that namespace only.

## Requirements

- Node.js >= 18.0.0 (LTS: 20, 22)
- TypeScript >= 4.5 (for decorators)
- Ubuntu 22.04+ / macOS / Windows

## License

MIT
