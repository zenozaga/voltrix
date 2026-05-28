# @voltrix/swagger

Automatic **OpenAPI 3.0** documentation generator and embedded viewer (Swagger UI) middleware for the **Voltrix** framework.

## Features

- **Dynamic Spec Generation**: Scan the `@voltrix/server` `RadixTree` and compile decorative controller metadata from `@voltrix/decorator` directly into valid OpenAPI specifications.
- **Metadata Inference**: Seamlessly extract route parameters, JSON schema shapes, response status codes, and authorization scopes.
- **Embedded Swagger UI Middleware**: Serves a highly optimized instance of Swagger UI to present your interactive API documentation interface with zero configuration.

## Installation

```bash
npm install @voltrix/swagger
```

## Usage Example (Programmatic API)

```typescript
import { createServer } from '@voltrix/server';
import { generateFromRouter, swaggerUi } from '@voltrix/swagger';

const server = createServer();

// Define a route with OpenAPI metadata
server.get('/users', (ctx) => ctx.json([]))
  .meta('openapi', {
    summary: 'Retrieve user list',
    tags: ['Users']
  });

// Compile the JSON specification document
const spec = generateFromRouter(server, { title: 'My Voltrix API', version: '1.0.0' });

// Mount the Swagger UI viewer middleware at /docs
server.any('/docs/*', swaggerUi(spec, '/docs'));

await server.listen({ port: 3000 });
console.log('API Docs available at http://localhost:3000/docs');
```

## License

MIT
