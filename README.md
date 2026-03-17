# Voltrix

Ultra-fast Node.js HTTP framework built on [uWebSockets.js](https://github.com/uNetworking/uWebSockets.js). Express-compatible API with decorator support, dependency injection, and OpenAPI generation — without sacrificing performance.

## Benchmark

Single-core, 100 concurrent connections, autocannon, loopback:

| Scenario | Pure Node | uWS raw | **Voltrix** |
|---|---|---|---|
| GET / | 88k | 88k | **94k** |
| GET /users/:id | 85k | 93k | **97k** |
| GET /deep/99 (100 routes) | 85k | 91k | **97k** |
| GET /mw (20 middlewares) | 87k | 90k | **95k** |
| POST /echo JSON | 74k | 94k | **99k** |
| POST /form URL-encoded | 63k | 99k | **95k** |

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
npm install @voltrix/express @voltrix/decorator @voltrix/injector reflect-metadata
```

```ts
import 'reflect-metadata';
import { Controller, Get, Post, Body, Param } from '@voltrix/decorator';
import { Injectable } from '@voltrix/injector';

@Injectable()
class UserService {
  find(id: string) {
    return { id, name: 'Alice' };
  }
}

@Controller('/users')
class UserController {
  constructor(private users: UserService) {}

  @Get('/:id')
  getUser(@Param('id') id: string) {
    return this.users.find(id);
  }

  @Post('/')
  createUser(@Body() body: any) {
    return body;
  }
}
```

```ts
import { ApplicationProcessor } from '@voltrix/decorator';
import { DIContainer } from '@voltrix/injector';
import voltrix from '@voltrix/express';

const app = voltrix();
const container = new DIContainer();

const processor = new ApplicationProcessor(app, {
  controllers: [UserController],
  providers: [UserService],
  container,
});

processor.process();
await app.listen(3000);
```

## OpenAPI / Swagger

```bash
npm install @voltrix/swagger
```

```ts
import { generateSpec } from '@voltrix/swagger';
import { ApiOperation, ApiResponse } from '@voltrix/swagger/decorator';

// Programmatic
const spec = generateSpec({
  info: { title: 'My API', version: '1.0.0' },
  routes: [{ method: 'get', path: '/ping', responses: { 200: { description: 'OK' } } }],
});

// Serve the spec
app.get('/openapi.json', (_req, res) => res.json(spec));
```

## Request API

```ts
app.post('/upload', async (req, res) => {
  // Body
  const text   = await req.body();         // string
  const json   = await req.json();         // parsed JSON
  const buffer = await req.buffer();       // Buffer

  // Params & Query
  const id   = req.getParam('id');
  const page = req.getQuery('page');

  // Headers
  const ct = req.header('content-type');

  // Multipart
  await req.parseMultipart(async (part) => {
    console.log(part.name, part.filename, part.data);
  });
});
```

## Response API

```ts
app.get('/demo', (req, res) => {
  res.status(201).json({ created: true });
  res.send('plain text');
  res.sendBuffer(buffer);
  res.redirect('/other');
  res.setHeader('X-Custom', 'value');
  res.render('view', { data });        // template engine
});
```

## Middleware

```ts
// Global
app.use((req, res, next) => {
  console.log(req.method, req.url);
  next();
});

// Error handler
app.useError((err, req, res, next) => {
  res.status(500).json({ error: err.message });
});

// Router
import { createRouter } from '@voltrix/express';

const router = createRouter();
router.get('/profile', handler);

app.use('/api/v1', router);
```

## Requirements

- Node.js >= 18.0.0 (LTS: 20, 22)
- TypeScript >= 4.5 (for decorators)
- Ubuntu 22.04+ / macOS / Windows

## Architecture

Voltrix wraps uWebSockets.js with a minimal abstraction layer:

- **Object pooling** — `Request` and `Response` instances are reused across requests
- **O(1) header lookup** — case-insensitive header map
- **Sync fast-path** — parameter resolvers skip `async/await` when no I/O is needed
- **Pre-compiled regex** — route patterns and multipart boundaries compiled once
- **LRU route cache** — frequently accessed routes bypass handler lookup

## License

MIT
