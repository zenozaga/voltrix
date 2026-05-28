# @voltrix/server

The core web engine of **Voltrix**. A hyper-optimized wrapper around `uWebSockets.js` designed for zero memory allocations on the request hot path.

## Features

- **Raw Speed**: Serves as the heart of Voltrix, achieving up to ~90,000 requests per second.
- **Fast Routing**: Features an ultra-efficient Radix Tree routing engine ($O(k)$ lookup complexity).
- **Zero-Allocation Memory Management**: Employs a pre-allocated object pool (`CtxPool`) to reuse context instances, mitigating Garbage Collection (GC) pauses during high throughput.
- **Hooks & Execution Pipeline**: Implements pre-classified execution phases (`onRequest`, `onResponse`, `onError`) optimized for raw performance.

## Installation

This is the recommended package if you require the absolute highest performance ceiling without Express compatibility overhead.

```bash
npm install @voltrix/server
```

## Usage Example

```typescript
import { createServer } from '@voltrix/server';

const server = createServer({ poolSize: 5000 });

server.get('/ping', (ctx) => {
  // Context is strongly typed and safe from allocations
  ctx.status(200).json({ pong: true });
});

server.post('/echo', async (ctx) => {
  const body = await ctx.readJson();
  ctx.json(body);
});

await server.listen({ port: 3000 });
console.log('Listening on http://localhost:3000');
```

## Advanced Features

### 1. Metadata (`.meta`)
You can easily bind custom metadata parameters to any route (ideal for Swagger generators, authorization checks, or documentation tools).

```typescript
server.get('/users/:id', (ctx) => {
  ctx.json({ id: ctx.params.id });
}).meta('openapi', {
  summary: 'Get user by ID',
  tags: ['Users']
});

// Later, you can extract all routes containing the 'openapi' metadata key:
const docs = server.routes().byMeta('openapi');
```

### 2. Plugins and Hooks (`onRequest`)
Voltrix relies on lightweight hook phases instead of a traditional Express-like middleware stack array to keep context allocations at zero. You can organize your code into modular units using `server.plugin()`.

```typescript
// Authentication Plugin
server.plugin(async (instance) => {
  // Decorate the context prototype (O(1), zero-allocation)
  instance.decorateCtx('user', null);

  // Global request hook executed before the handler
  instance.onRequest((ctx) => {
    const auth = ctx.header('authorization');
    if (!auth) {
      ctx.status(401).json({ error: 'Missing token' });
      return; // Short-circuit execution
    }
    // Reassignment is blazing fast as ctx.user is already on the prototype
    ctx.user = { id: 1, role: 'admin' }; 
  });
});
```

### 3. Schema Validation
You can easily parse and validate payloads inside your handlers asynchronously or synchronously using validation libraries like Zod.

```typescript
import { z } from 'zod';

const UserSchema = z.object({
  name: z.string().min(3),
  age: z.number().int()
});

server.post('/users', async (ctx) => {
  try {
    const rawBody = await ctx.readJson();
    
    // Zod validation
    const validData = UserSchema.parse(rawBody);
    
    ctx.status(201).json({ success: true, data: validData });
  } catch (error) {
    if (error instanceof z.ZodError) {
      ctx.status(400).json({ error: 'Validation failed', issues: error.issues });
    } else {
      ctx.status(500).json({ error: 'Internal server error' });
    }
  }
});
```

### 4. High-Performance Serializer (`JsonWriter`)
Voltrix features an internal high-performance serializer utility called `JsonWriter` designed to construct JSON strings directly at the byte level (**Buffer**) with zero intermediate string concatenation. This allows genuine **Zero-Copy** serialization on critical hot paths.

#### Manual Serialization (Maximum Throughput)
Perfect for fixed, well-known response shapes where every microsecond matters. You can pre-allocate and reset a single writer instance to prevent GC pressure.

```typescript
import { JsonWriter } from '@voltrix/server';

// Pre-allocate a single byte buffer (lives outside the request hot path)
const writer = new JsonWriter(512);

server.get('/fast-api', (ctx) => {
  // Construct JSON bytes manually
  writer.reset()
    .objectStart()
      .key('status').string('ok')
      .key('timestamp').number(Date.now())
      .key('metrics')
        .arrayStart()
          .number(1.2).number(3.4)
        .arrayEnd()
    .objectEnd();

  // Send the constructed raw buffer directly
  ctx.send(writer.toBuffer());
});
```

#### Global Serializer Compiler Pattern
If you prefer schema models, you can define a **Serializer Compiler**. Voltrix will compile these schemas at startup, completely eliminating schema lookups during requests.

```typescript
const myCompiler = {
  compile: (schema) => {
    // Generate an optimized pre-compiled function (e.g. using JsonWriter or fast-json-stringify)
    return (data) => JSON.stringify(data);
  }
};

server.setSerializerCompiler(myCompiler);
```

This pattern ensures that during active request processing, Voltrix invokes your compiled schema serialization function directly, approaching the physical limits of network card bandwidth with zero runtime overhead.

## License

MIT
