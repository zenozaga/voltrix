# @voltrix/decorator

TypeScript decorator library for the Voltrix Express framework. Provides class, method, and parameter decorators for routing, middleware, security, dependency injection, and OpenAPI documentation.

## Requirements

- Node.js >= 18
- TypeScript >= 4.5
- `"experimentalDecorators": true` and `"emitDecoratorMetadata": true` in `tsconfig.json`

## Installation

```bash
npm install @voltrix/decorator
```

---

## Bootstrap

### Minimal application

```typescript
import { VoltrixApp, Module, Controller, Get, createApplication } from '@voltrix/decorator';

@Controller()
class PingController {
  @Get('/ping')
  async ping() {
    return { message: 'pong' };
  }
}

@Module({
  controllers: [PingController]
})
class AppModule {}

@VoltrixApp({
  name: 'MyApp',
  modules: [AppModule],
  port: 3000
})
class App {}

const { app } = await createApplication(App);
await app.listen(3000);
```

`createApplication` processes all decorator metadata and returns `{ app }`, where `app` is a Voltrix instance. Call `app.listen(port)` to start the server and `app.close()` to shut it down.

### VoltrixApp options

| Option | Type | Description |
|---|---|---|
| `name` | `string` | Application name (required) |
| `modules` | `Constructor[]` | Root modules (required) |
| `providers` | `Provider[]` | Global DI providers |
| `middlewares` | `Middleware[]` | Global middleware |
| `prefix` | `string` | Global path prefix |
| `port` | `number` | Default port (default: 3000) |
| `version` | `string` | Application version |
| `description` | `string` | Application description |

---

## Modules

```typescript
@Module({
  path: 'users',
  controllers: [UserController],
  providers: [UserService],
  modules: [AuditModule],
  middlewares: [logMiddleware]
})
class UserModule {}
```

Modules can be nested recursively. The `path` value is prepended to all controller paths within the module.

### Module options

| Option | Type | Description |
|---|---|---|
| `path` | `string` | Path prefix for all controllers in this module |
| `controllers` | `Constructor[]` | Controllers belonging to this module |
| `providers` | `Provider[]` | Module-scoped DI providers |
| `modules` | `Constructor[]` | Sub-modules |
| `middlewares` | `Middleware[]` | Module-level middleware |
| `prefix` | `string` | Additional path prefix |

---

## Controllers

```typescript
@Controller('/orders')
class OrderController {
  @Get('/:id')
  async getOrder() { ... }
}
```

`@Controller` accepts a path string or an options object:

```typescript
@Controller({ path: '/orders', middlewares: [authMiddleware] })
class OrderController { ... }
```

Calling `@Controller()` with no arguments registers the controller with an empty path.

---

## HTTP Route Decorators

All route decorators accept an optional path (defaults to `/`) and an optional options object.

```typescript
@Get(path?, options?)
@Post(path?)
@Put(path?)
@Patch(path?)
@Delete(path?)
@Head(path?)
@Options(path?)
@All(path?)
```

Additional decorators available: `Connect`, `Upgrade`, `Trace`, `WS`.

```typescript
@Controller('/items')
class ItemController {
  @Get()
  async list() { return []; }

  @Get('/:id')
  async getOne() { ... }

  @Post()
  async create() { ... }

  @Put('/:id')
  async replace() { ... }

  @Patch('/:id')
  async update() { ... }

  @Delete('/:id')
  async remove() { ... }
}
```

### RouteOptions

```typescript
interface RouteOptions {
  middlewares?: Middleware[];
  roles?: string[];
  scopes?: string[];
  auth?: boolean;
  rateLimit?: { max: number; window: number };
}
```

---

## Parameter Decorators

### @Query

Extracts a query string parameter by name.

```typescript
@Get('/search')
async search(@Query('name') name: string) {
  return { name };
}
// GET /search?name=Voltrix  =>  { name: 'Voltrix' }
```

### @Param

Extracts a route path parameter by name.

```typescript
@Get('/path/:id')
async getById(@Param('id') id: string) {
  return { id };
}
// GET /path/42  =>  { id: '42' }
```

### @Body

Extracts the request body. Accepts a class constructor for deserialization, an options object for transformation, or no arguments for the raw body.

```typescript
class User {
  constructor(public name: string, public age: number) {}
}

// Deserialize into a class instance
@Post('/users')
async create(@Body(User) user: User) {
  return user;
}

// Custom inline transform
@Post('/transform')
async transform(
  @Body({ transform: (data: any) => ({ ...data, processed: true }) }) body: any
) {
  return body;
}

// Mark for global transformer (see useTransformer below)
@Post('/validate')
async validate(@Body({ schema: 'my-schema' }) body: any) {
  return body;
}

// Raw body
@Post('/raw')
async raw(@Body() body: any) {
  return body;
}
```

### @Header

Extracts a request header by name.

```typescript
@Get('/info')
async info(@Header('user-agent') ua: string) {
  return { ua };
}
```

### @Cookie

Extracts a cookie value by name.

```typescript
@Get('/me')
async me(@Cookie('session') session: string) { ... }
```

### @Req / @Res

Inject the raw request or response objects.

```typescript
import { Req, Res } from '@voltrix/decorator';

@Get('/raw')
async raw(@Req() req: any, @Res() res: any) {
  res.send('ok');
}
```

### Custom parameter decorators

```typescript
import { createCustomRequestDecorator } from '@voltrix/decorator';

const CurrentUser = () =>
  createCustomRequestDecorator('CurrentUser', (req) => req.user);
```

### Parser helper

Integrates any schema library that exposes a `.parse` method:

```typescript
import { Parser } from '@voltrix/decorator';
import { z } from 'zod';

const CreateUserSchema = z.object({ name: z.string(), age: z.number() });

@Post('/users')
async create(@Parser(CreateUserSchema) user: { name: string; age: number }) {
  return user;
}
```

---

## Middleware

`@Middleware` can be applied to a controller class or a route method. Middleware also runs when passed through the `middlewares` option at the app, module, or controller level.

Execution order: **App -> Module -> Controller -> Method**

```typescript
const logMiddleware = (req: any, res: any, next: any) => {
  console.log(req.method, req.url);
  next();
};

@Controller('/items')
@Middleware(logMiddleware)            // runs before every route in this controller
class ItemController {
  @Get()
  @Middleware(rateLimitMiddleware)    // runs only for this route
  async list() { ... }
}
```

Passing middleware at the module or app level:

```typescript
@Module({
  controllers: [ItemController],
  middlewares: [logMiddleware]        // module-level
})
class ItemModule {}

@VoltrixApp({
  name: 'App',
  modules: [ItemModule],
  middlewares: [corsMiddleware]       // app-level
})
class App {}
```

### Conditional middleware

```typescript
// Only run on paths matching the pattern
Middleware.only(/^\/api/, authMiddleware)

// Skip paths matching the pattern
Middleware.exclude(/^\/public/, authMiddleware)
```

---

## Security

### @Scope

Requires the authenticated user to have the specified scope. Auth middleware must populate `req.user.scopes` before security checks run.

```typescript
const authMiddleware = (req: any, res: any, next: any) => {
  const userJson = req.header('x-user');
  if (userJson) req.user = JSON.parse(userJson);
  next();
};

@VoltrixApp({
  name: 'App',
  modules: [AppModule],
  middlewares: [authMiddleware]
})
class App {}

@Controller('/security')
class SecurityController {
  @Get('/admin-only')
  @Scope('admin')
  async adminOnly() { return { ok: true }; }

  @Get('/reports')
  @Scope('finance:read')
  async reports() { return { ok: true }; }
}
```

Supported wildcard patterns:

- `*` — matches any scope
- `user:*` — matches any scope starting with `user:`

### @Role

Requires the authenticated user to have the specified role. Auth middleware must populate `req.user.roles`.

```typescript
@Post('/promote')
@Role('admin')
async promote() { return { ok: true }; }
```

Both `@Scope` and `@Role` accept multiple values:

```typescript
@Scope('admin', 'super-admin')
@Role('editor', 'publisher')
```

Custom failure handler:

```typescript
@Scope({ scopes: ['admin'], onFail: (req, res) => res.status(403).json({ error: 'Forbidden' }) })
async adminRoute() { ... }
```

### @Public

Marks a route as publicly accessible, bypassing scope/role checks.

```typescript
import { Public } from '@voltrix/decorator';

@Get('/status')
@Public()
async status() { return { ok: true }; }
```

### Expected user shape

Auth middleware must set `req.user` before security decorators evaluate:

```typescript
req.user = {
  scopes: ['admin', 'user:read'],
  roles: ['editor']
};
```

Unauthenticated requests (no `req.user`) to guarded routes receive a `403` response.

---

## Dependency Injection

### @Injectable

Marks a class as injectable. Import from `@voltrix/injector`.

```typescript
import { Injectable } from '@voltrix/injector';

@Injectable()
class UserService {
  findAll() { return []; }
}
```

### @Inject

Injects a dependency into a constructor parameter or class property.

```typescript
import { Inject } from '@voltrix/decorator';

@Controller('/users')
class UserController {
  constructor(
    @Inject(UserService) private userService: UserService
  ) {}

  @Get()
  async list() {
    return this.userService.findAll();
  }
}
```

### Provider scoping

App-level providers are available to all modules. Module-level providers are scoped to that module.

```typescript
@Injectable()
class GlobalService {
  getData() { return 'global'; }
}

@Injectable()
class ModuleService {
  constructor(@Inject(GlobalService) private global: GlobalService) {}
  getData() { return `module + ${this.global.getData()}`; }
}

@Module({
  controllers: [DIController],
  providers: [ModuleService]          // scoped to this module
})
class TestModule {}

@VoltrixApp({
  name: 'App',
  modules: [TestModule],
  providers: [GlobalService]          // available everywhere
})
class App {}
```

---

## Global Body Transformer

Register a single transformer function invoked for any `@Body({ schema: 'name' })` parameter. Must be called after `createApplication` and before `app.listen`.

```typescript
const { app } = await createApplication(App);

app.useTransformer(({ schema, data, type, key }) => {
  if (schema === 'my-schema') {
    return { ...data, validated: true };
  }
  return data;
});

await app.listen(3000);
```

Transformer context object:

| Property | Description |
|---|---|
| `schema` | The schema name passed to `@Body({ schema })` |
| `data` | The raw parsed body |
| `type` | The TypeScript type (if available via reflection) |
| `key` | The parameter name |

---

## Swagger / OpenAPI Integration

```typescript
import { Swagger } from '@voltrix/decorator';

@Controller('/users')
@Swagger.Namespace('Users')
class UserController {
  @Get()
  @Swagger.Tags('users', 'public')
  @Swagger.Summary('List all users')
  @Swagger.Response(200, { description: 'Success' })
  async list() { return []; }
}
```

| Decorator | Description |
|---|---|
| `@Swagger.Tags(...tags)` | Assign OpenAPI tags to a route |
| `@Swagger.Summary(text)` | Set the OpenAPI summary for a route |
| `@Swagger.Namespace(name)` | Group routes under a namespace (inherited by child routes) |
| `@Swagger.Response(code, spec)` | Define an OpenAPI response for a route |

Namespace inheritance: if a controller has a `@Swagger.Namespace` but a route does not, the route inherits the controller's namespace. The same rule applies from module to controller.

---

## Metadata Inspection

### MetadataRegistry

Access raw decorator metadata for any class.

```typescript
import { MetadataRegistry } from '@voltrix/decorator';

const bag = MetadataRegistry.get(UserController);
// bag.type        => 'controller'
// bag.options     => { path: '/user' }
// bag.routes      => Map<string|symbol, RouteInfo>
// bag.middlewares => Map of middleware arrays
// bag.parameters  => Map of parameter definitions
// bag.custom      => Map of custom metadata (scopes, roles, etc.)
```

### DiscoveryCollector

Builds the full resolved application tree from the root app class. Called internally by `createApplication` but also available for tools such as OpenAPI generators.

```typescript
import { DiscoveryCollector } from '@voltrix/decorator/processors/discovery.collector';

const tree = await DiscoveryCollector.buildTree(App);
// tree.name    => 'MyApp'
// tree.modules => ModuleNode[]

const moduleNode = tree.modules[0];
// moduleNode.target      => ModuleClass
// moduleNode.fullPath    => '/users'
// moduleNode.controllers => ControllerNode[]
// moduleNode.subModules  => ModuleNode[]

const ctrlNode = moduleNode.controllers[0];
// ctrlNode.target     => ControllerClass
// ctrlNode.fullPath   => '/users/profile'
// ctrlNode.routes     => RouteNode[]

const route = ctrlNode.routes[0];
// route.method      => 'GET'
// route.fullPath    => '/users/profile/'
// route.propertyKey => 'list'
// route.meta        => { parameters, context, openapi, ... }
```

Route full paths are constructed by joining module path, controller path, and route path, with duplicate slashes collapsed.

### SecurityRegistry

Query all scopes and roles declared across the application. Populated during `createApplication` and as each `@Scope` or `@Role` decorator is evaluated.

```typescript
import { SecurityRegistry } from '@voltrix/decorator';

const scopes = SecurityRegistry.getAllScopes(); // string[]
const roles  = SecurityRegistry.getAllRoles();  // string[]
```

Shorthand methods are also available directly on the decorators:

```typescript
Scope.getAll(); // same as SecurityRegistry.getAllScopes()
Role.getAll();  // same as SecurityRegistry.getAllRoles()
```

---

## Complete example

```typescript
import {
  VoltrixApp, Module, Controller,
  Get, Post, Delete,
  Query, Param, Body, Header,
  Middleware, Scope, Role,
  createApplication,
  Inject
} from '@voltrix/decorator';
import { Injectable } from '@voltrix/injector';

// --- Service ---

@Injectable()
class OrderService {
  private orders: any[] = [];

  create(data: any) {
    const order = { id: Date.now().toString(), ...data };
    this.orders.push(order);
    return order;
  }

  findAll(status?: string) {
    return status ? this.orders.filter(o => o.status === status) : this.orders;
  }

  process(orderId: string) {
    return { orderId, status: 'processed', timestamp: Date.now() };
  }
}

// --- Auth middleware ---

const authMiddleware = (req: any, res: any, next: any) => {
  const userJson = req.header('x-test-user');
  if (userJson) req.user = JSON.parse(userJson);
  next();
};

// --- Controller ---

@Controller('/orders')
class OrderController {
  constructor(@Inject(OrderService) private service: OrderService) {}

  @Get()
  async list(@Query('status') status: string) {
    return this.service.findAll(status);
  }

  @Post('/:id/pay')
  @Scope('finance:write')
  async pay(@Param('id') id: string, @Query('method') method: string, @Body() details: any) {
    const result = this.service.process(id);
    return { ...result, method, details };
  }

  @Delete('/:id')
  @Role('admin')
  async remove(@Param('id') id: string) {
    return { deleted: id };
  }
}

// --- Module ---

@Module({
  path: 'v1',
  controllers: [OrderController],
  providers: [OrderService]
})
class ApiModule {}

// --- Application ---

@VoltrixApp({
  name: 'MyApp',
  version: '1.0.0',
  modules: [ApiModule],
  middlewares: [authMiddleware],
  port: 3000
})
class App {}

// --- Bootstrap ---

const { app } = await createApplication(App);

app.useTransformer(({ schema, data }) => {
  if (schema === 'order') {
    return { ...data, validated: true };
  }
  return data;
});

await app.listen(3000);
```

---

## License

MIT
