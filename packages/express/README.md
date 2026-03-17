# @voltrix/express

Ultra-fast HTTP/WebSocket server framework built on [uWebSockets.js](https://github.com/uNetworking/uWebSockets.js). Provides an Express-like API with TypeScript support, object pooling, LRU route caching, and a composable middleware pipeline.

## Requirements

- Node.js >= 18.0.0

## Installation

```sh
npm install @voltrix/express
```

## Quick Start

```ts
import voltrix from '@voltrix/express';

const app = voltrix();

app.get('/hello', (req, res) => {
  res.json({ message: 'Hello, world!' });
});

await app.listen(3000);
```

## Creating the App

```ts
import { voltrix, Voltrix } from '@voltrix/express';

// Factory function (recommended)
const app = voltrix();

// Class instantiation
const app = new Voltrix();

// With options
const app = voltrix({
  cacheSize: 512,
  cacheTTL: 60000,
  routeCacheSize: 1024,
  routeCacheTTL: 60000,
});
```

## HTTP Routes

All standard HTTP methods are supported. Handlers receive a `Request` and `Response` object.

```ts
app.get('/users',         (req, res) => { /* ... */ });
app.post('/users',        (req, res) => { /* ... */ });
app.put('/users/:id',     (req, res) => { /* ... */ });
app.patch('/users/:id',   (req, res) => { /* ... */ });
app.delete('/users/:id',  (req, res) => { /* ... */ });
app.options('/resource',  (req, res) => { /* ... */ });
app.head('/resource',     (req, res) => { /* ... */ });

// Matches any HTTP method
app.any('/catchall', (req, res) => { /* ... */ });
```

### Dynamic Parameters

```ts
app.get('/users/:id', (req, res) => {
  const id = req.getParam('id');   // string
  // or via req.params object
  const id2 = req.params.id;
  res.json({ id });
});

app.get('/posts/:postId/comments/:commentId', (req, res) => {
  res.json({
    postId:    req.getParam('postId'),
    commentId: req.getParam('commentId'),
  });
});
```

### Wildcard Routes

```ts
app.get('/files/*', (req, res) => {
  res.json({ path: req.url });
});
```

Static routes take priority over dynamic and wildcard routes.

## Request Object

### URL and Method

```ts
app.get('/info', (req, res) => {
  console.log(req.method); // 'GET'
  console.log(req.url);    // '/info?foo=bar'
});
```

### Query Parameters

```ts
app.get('/search', (req, res) => {
  // All query params as a parsed object
  const { q, page } = req.query;

  // Single param by name
  const q2 = req.getQuery('q');

  res.json({ q, page });
});
```

### Headers

```ts
app.get('/headers', (req, res) => {
  const auth = req.header('authorization');
  const all  = req.headers(); // Record<string, string>
  res.json({ auth });
});
```

### Body Parsing

Body reads are asynchronous. Read the body only once per request.

```ts
// Parse JSON body
app.post('/json', async (req, res) => {
  const data = await req.json();
  res.json({ received: data });
});

// Read body as string
app.post('/text', async (req, res) => {
  const text = await req.body();
  res.send(text);
});

// Read body as Buffer
app.post('/binary', async (req, res) => {
  const buf = await req.buffer();
  res.sendBuffer(buf);
});
```

### Streaming Body

For large uploads or streaming scenarios use `onData`. The callback receives raw chunks and a flag indicating the final chunk.

```ts
app.post('/stream', (req, res) => {
  let total = 0;

  req.onData((chunk: Uint8Array, isLast: boolean) => {
    total += chunk.length;
    if (isLast) {
      res.json({ bytesReceived: total });
    }
  });
});
```

### Multipart Uploads

```ts
app.post('/upload', async (req, res) => {
  const parts: { name: string; data: string }[] = [];

  await req.parseMultipart((part) => {
    // part.name        — field name
    // part.filename    — original filename (for file fields)
    // part.contentType — MIME type (for file fields)
    // part.onData      — assign a handler to receive chunk data

    const chunks: Uint8Array[] = [];

    part.onData = (chunk: Uint8Array, isLast: boolean) => {
      if (chunk.length > 0) chunks.push(chunk);

      if (isLast) {
        const full = Buffer.concat(chunks.map(c => Buffer.from(c)));
        parts.push({ name: part.name, data: full.toString() });
      }
    };
  });

  res.json({ count: parts.length, parts });
});
```

### Request Context

`req.context` is a plain object that is reset for every new request. Use it to pass data between middleware and route handlers within a single request lifecycle.

```ts
app.use((req, res, next) => {
  req.context.userId = 'user_123';
  next();
});

app.get('/dashboard', (req, res) => {
  res.json({ userId: req.context.userId });
});
```

## Response Object

### Sending Responses

```ts
// JSON response (sets Content-Type: application/json)
res.json({ ok: true });

// Plain text or HTML string
res.send('Hello');

// Raw buffer
res.sendBuffer(buffer);

// Stream a file from disk (async)
await res.sendFile('/absolute/path/to/file.pdf');
```

### Status Code

`status()` is chainable.

```ts
res.status(201).json({ created: true });
res.status(204).end();
```

### Headers

Both `setHeader` and `header` are chainable aliases.

```ts
res.setHeader('X-Request-Id', '123').json({ ok: true });
res.header('Cache-Control', 'no-store').send('no cache');
```

### Redirects

```ts
res.redirect('/new-location');
res.redirect('/login', 301);
```

### Response Locals

`res.locals` is a plain object reset per request. Use it alongside middleware to pass rendering or template data.

```ts
app.use((req, res, next) => {
  res.locals.title = 'Dashboard';
  next();
});

app.get('/page', (req, res) => {
  res.json({ title: res.locals.title });
});
```

## Middleware

### Global Middleware

```ts
app.use((req, res, next) => {
  res.header('X-Powered-By', 'Voltrix');
  next();
});
```

### Error Middleware

```ts
app.useError((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});
```

Errors thrown inside route handlers or middleware are automatically forwarded to registered error handlers.

### 404 Handler

```ts
app.useNotFound((req, res) => {
  res.status(404).json({ error: 'Not found' });
});
```

## Router

Routers group related routes and can be mounted at a path prefix.

```ts
import { createRouter } from '@voltrix/express';

const userRouter = createRouter();

userRouter.get('/profile', (req, res) => {
  res.json({ user: 'profile' });
});

userRouter.post('/profile', async (req, res) => {
  const body = await req.json();
  res.status(201).json({ updated: true, body });
});

// Mount at /users — routes become /users/profile
app.use('/users', userRouter);
```

### Router Middleware

Middleware registered on a router applies only to that router's routes.

```ts
const apiRouter = createRouter();

apiRouter.use((req, res, next) => {
  // e.g. authenticate before any route in this router
  next();
});

apiRouter.get('/data', (req, res) => {
  res.json({ data: [] });
});

app.use('/api', apiRouter);
```

### Route-Level Middleware

Pass one or more middleware functions before the handler.

```ts
const authMiddleware = (req, res, next) => {
  // validate token, then call next()
  next();
};

router.get('/protected', authMiddleware, (req, res) => {
  res.json({ secret: true });
});
```

### Nested Routers

```ts
const userRouter = createRouter();
const postRouter = createRouter();

postRouter.get('/list', (req, res) => res.json({ posts: [] }));

userRouter.use('/posts', postRouter);
app.use('/users', userRouter);
// => GET /users/posts/list
```

## Serving Static Files

```ts
import { static as serveStatic } from '@voltrix/express';

app.use(serveStatic('./public'));

// With options
app.use('/assets', serveStatic('./dist', {
  index: 'index.html', // served when a directory is requested (default: 'index.html')
  fallthrough: true,   // pass to next middleware when file not found (default: true)
}));
```

## WebSockets

`app.ws` accepts a path and a uWebSockets.js behavior object.

```ts
app.ws('/chat', {
  open(ws) {
    ws.subscribe('room/general');
  },
  message(ws, message, isBinary) {
    ws.publish('room/general', message, isBinary);
  },
  close(ws, code, message) {
    console.log('disconnected');
  },
});
```

WebSockets can also be registered on a router and mounted with a prefix via `app.use(prefix, router)`.

## Lifecycle

```ts
// Start listening — returns a Promise
await app.listen(3000);

// Graceful shutdown
await app.close();
```

## Diagnostics

```ts
const stats = app.getStats();
// {
//   cacheHits: number,
//   cacheMisses: number,
//   totalRequests: number,
//   handlerCacheSize: number,
//   routeCache: { size: number, ... }
// }

app.clearAllCaches();    // clear both handler and route caches
app.clearHandlerCache();
app.clearRouteCache();
```

## TypeScript

All public types are exported from the package root.

```ts
import type { Middleware, ErrorMiddleware, HandlerFunction } from '@voltrix/express';

const logger: Middleware = (req, res, next) => {
  console.log(req.method, req.url);
  next();
};

const errorHandler: ErrorMiddleware = (err, req, res, next) => {
  res.status(500).json({ error: err.message });
};
```

## License

MIT
