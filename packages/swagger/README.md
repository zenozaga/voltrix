# @voltrix/swagger

OpenAPI 3.0 specification generator for the Voltrix framework. Supports two generation strategies: programmatic (router-based) and decorator-based. Both strategies produce a standard `OpenAPIDoc` object that can be served as JSON or rendered via the bundled Swagger UI helper.

## Installation

```bash
npm install @voltrix/swagger
```

## Package Exports

| Entry point | Contents |
|---|---|
| `@voltrix/swagger` | `generateFromRouter`, `generateFromTree`, `swaggerUi`, core types |
| `@voltrix/swagger/server` | `generateFromRouter` only |
| `@voltrix/swagger/decorator` | `Swagger` namespace, `generateFromTree`, individual `Api*` decorators |

---

## Programmatic API (router-based)

Use this approach when you define routes with `createRouter` from `@voltrix/express`.

### Basic usage

```ts
import { createRouter } from '@voltrix/express';
import { generateFromRouter } from '@voltrix/swagger';

const router = createRouter('/v1');

router.get('/users', listUsers).meta({
  summary: 'List users',
  tags: ['Users'],
});

router.post('/users/:id', updateUser).meta({
  summary: 'Update user',
  tags: ['Users'],
  responses: {
    200: { description: 'Updated' },
    404: { description: 'Not found' },
  },
});

const spec = generateFromRouter(router, {
  title: 'My API',
  version: '1.0.0',
});

// spec.openapi === '3.0.0'
// spec.paths['/v1/users'].get.summary === 'List users'
// spec.paths['/v1/users/{id}'].post  (path param :id converted to {id})
```

### Path parameter conversion

Express-style path parameters (`:id`) are automatically converted to OpenAPI-style parameters (`{id}`), and a corresponding parameter object is added to the operation:

```ts
router.get('/orders/:orderId/items/:itemId', handler).meta({
  summary: 'Get order item',
});

// Generates path: /v1/orders/{orderId}/items/{itemId}
// Parameters: [{ name: 'orderId', in: 'path' }, { name: 'itemId', in: 'path' }]
```

### `.meta()` options

| Field | Type | Description |
|---|---|---|
| `summary` | `string` | Short operation summary |
| `description` | `string` | Longer operation description |
| `tags` | `string[]` | Logical grouping tags |
| `operationId` | `string` | Unique operation identifier |
| `namespace` | `string` | Namespace used to filter routes during generation |
| `responses` | `Record<number, OpenAPIResponse>` | Response definitions |
| `requestBody` | `OpenAPIRequestBody` | Request body definition |
| `parameters` | `OpenAPIParameter[]` | Additional explicit parameters |
| `security` | `Record<string, string[]>[]` | Security requirements |
| `deprecated` | `boolean` | Mark operation as deprecated |
| `exclude` | `boolean` | Exclude from all generated specs |

### `generateFromRouter` options

```ts
interface SwaggerOptions {
  title?: string;
  version?: string;
  description?: string;
  namespace?: string;
  servers?: { url: string; description?: string }[];
}
```

---

## Multi-spec generation with namespaces (programmatic)

Attach a `namespace` to each route via `.meta()` and pass the same option to `generateFromRouter` to produce separate specs from a single router.

```ts
import { createRouter } from '@voltrix/express';
import { generateFromRouter } from '@voltrix/swagger';

const router = createRouter();

router.get('/public/info', handler).meta({
  namespace: 'public',
  summary: 'Public Info',
  tags: ['Info'],
});

router.get('/admin/config', handler).meta({
  namespace: 'admin',
  summary: 'Admin Config',
  tags: ['Admin'],
});

const publicSpec = generateFromRouter(router, {
  title: 'Public API',
  version: '1.0.0',
  namespace: 'public',
});
// publicSpec.paths['/public/info']  -- present
// publicSpec.paths['/admin/config'] -- absent

const adminSpec = generateFromRouter(router, {
  title: 'Admin API',
  version: '1.0.0',
  namespace: 'admin',
});
// adminSpec.paths['/admin/config']  -- present
// adminSpec.paths['/public/info']   -- absent
```

Routes with no `namespace` set in `.meta()` are excluded when a `namespace` filter is active in `generateFromRouter`.

---

## Decorator-based API

Use this approach when you define routes with `@Controller`, `@Get`, `@Post`, etc. from `@voltrix/decorator`.

### Decorator reference

All decorators live under the `Swagger` namespace exported from `@voltrix/swagger/decorator`. They can be applied at the controller level (inherited by all methods) or at the method level (overrides the controller value).

| Decorator | Target | Description |
|---|---|---|
| `@Swagger.Tags('tag1', 'tag2')` | Controller, Method | Logical grouping tags. Controller tags are merged with method tags. |
| `@Swagger.Namespace('name')` | Controller, Method | Assigns a namespace. Method-level overrides the controller-level value. |
| `@Swagger.Summary('text')` | Method | Short operation summary. |
| `@Swagger.Description('text')` | Method | Longer operation description. |
| `@Swagger.Id('operationId')` | Method | Unique operation identifier. |
| `@Swagger.Response(status, options)` | Method | Declares a response. `options` is `{ description, schema? }`. |
| `@Swagger.Body(options)` | Method | Declares a request body. |
| `@Swagger.Param('name', options?)` | Method | Adds a path parameter. |
| `@Swagger.Query('name', options?)` | Method | Adds a query parameter. |
| `@Swagger.Header('name', options?)` | Method | Adds a header parameter. |
| `@Swagger.Cookie('name', options?)` | Method | Adds a cookie parameter. |
| `@Swagger.Security('scheme', ...scopes)` | Controller, Method | Declares a security requirement. |
| `@Swagger.Deprecated()` | Controller, Method | Marks the operation as deprecated. |
| `@Swagger.Exclude()` | Controller, Method | Excludes the route from all generated specs. |
| `@Swagger.Schema(options)` | Controller, Method | Manually defines a schema. |
| `@Swagger.ExternalDoc(url, description?)` | Method | Links external documentation. |
| `@Swagger.Extension('x-key', value)` | Method | Adds a custom `x-` extension field. |

### Basic usage

```ts
import 'reflect-metadata';
import { Controller, Get, Post, Param, Module, VoltrixApp, DiscoveryCollector } from '@voltrix/decorator';
import { Swagger, generateFromTree } from '@voltrix/swagger/decorator';

@Controller('/products')
@Swagger.Tags('E-commerce')
@Swagger.Namespace('public')
class ProductController {

  @Get(':id')
  @Swagger.Summary('Get product')
  @Swagger.Response(200, { description: 'Found' })
  async getProduct(@Param('id') id: string) {}

  @Post('/')
  @Swagger.Namespace('admin')   // overrides controller-level 'public'
  @Swagger.Summary('Create product')
  async createProduct() {}
}

@Module({ controllers: [ProductController] })
class AppModule {}

@VoltrixApp({ name: 'MyApp', modules: [AppModule] })
class MyApp {}

// Build the metadata tree then generate the spec
const tree = await DiscoveryCollector.buildTree(MyApp);

const fullSpec   = generateFromTree(tree);
const publicSpec = generateFromTree(tree, { namespace: 'public' });
const adminSpec  = generateFromTree(tree, { namespace: 'admin' });
```

Namespace resolution for the decorator approach:

- If a method has its own `@Swagger.Namespace`, that value is used.
- If only the controller has `@Swagger.Namespace`, that value is inherited by every method that does not override it.
- When `namespace` is set on `generateFromTree` options, only routes whose resolved namespace matches are included.

### Return type inference

When TypeScript emits decorator metadata (`emitDecoratorMetadata: true`), `generateFromTree` reads the `design:returntype` metadata key from the method. If the return type is a class, a `$ref` pointing to that class is automatically added as the `200` response schema and the class definition is placed in `components.schemas`.

```ts
class ProductDto {
  id: string = '';
  name: string = '';
}

@Controller('/products')
class ProductController {
  @Get(':id')
  getProduct(): ProductDto { /* ... */ }
  // Auto-generates: responses.200.content['application/json'].schema.$ref = '#/components/schemas/ProductDto'
}
```

No explicit `@Swagger.Response` is required when return type inference is active.

---

## Serving the spec with Swagger UI

`swaggerUi` returns a Voltrix-compatible middleware that serves the interactive UI at a given path and the raw JSON spec at `<path>/openapi.json`.

```ts
import { createServer } from '@voltrix/express';
import { generateFromRouter, swaggerUi } from '@voltrix/swagger';

const router = createRouter('/api');
// ... define routes ...

const spec = generateFromRouter(router, { title: 'My API', version: '1.0.0' });

const app = createServer();
app.use(swaggerUi(spec, '/docs'));

// GET /docs         -> Swagger UI HTML
// GET /docs/openapi.json -> OpenAPI spec JSON
```

The default path is `/docs` when the second argument is omitted.

---

## TypeScript configuration

The decorator-based approach requires the following `tsconfig.json` flags:

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

Return type inference additionally depends on `emitDecoratorMetadata`.

---

## License

MIT
