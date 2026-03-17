# @voltrix/injector

Dependency injection container with decorator and `reflect-metadata` support for the Voltrix framework.

## Installation

```bash
pnpm add @voltrix/injector reflect-metadata
```

Ensure `reflect-metadata` is imported once at the entry point of your application:

```typescript
import 'reflect-metadata';
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
import { DIContainer, Injectable, Inject, Singleton } from '@voltrix/injector';

@Singleton()
class Database {
  query(sql: string) { /* ... */ }
}

@Injectable()
class UserService {
  constructor(@Inject(Database) private db: Database) {}

  findAll() {
    return this.db.query('SELECT * FROM users');
  }
}

const container = new DIContainer();
container.registerMany([Database, UserService]);

const userService = container.get(UserService);
userService.findAll();
```

## Container

### Creating a Container

```typescript
import { DIContainer } from '@voltrix/injector';

// Standalone container
const container = new DIContainer();

// Child container (inherits registrations from parent)
const child = new DIContainer(parentContainer);

// Container with auto-injection enabled
const container = new DIContainer(null, { autoInject: true });

// Create a child via method
const child = container.createChild();
```

### Registering Providers

**Class provider** — instantiates the class on resolution:

```typescript
container.register({ token: UserService, useClass: UserService });

// With explicit scope
container.register({ token: UserService, useClass: UserService, scope: 'singleton' });

// Register an implementation behind an abstract type
abstract class ILogger {}
class ConsoleLogger extends ILogger {}
container.register({ token: ILogger, useClass: ConsoleLogger });
```

**Value provider** — returns a constant:

```typescript
const DB_URL = Symbol('DB_URL');
container.register({ token: DB_URL, useValue: 'postgresql://localhost/mydb' });
```

**Factory provider** — calls a function to produce the value:

```typescript
const CONFIG = Symbol('CONFIG');
container.register({
  token: CONFIG,
  useFactory: (container) => ({
    db: container.get(DB_URL),
    port: 3000,
  }),
});
```

**Alias provider** — forwards resolution to another token:

```typescript
container.register({ token: 'primary', useValue: 'main-db' });
container.register({ token: 'replica', useExisting: 'primary' });
// container.get('replica') === container.get('primary')
```

**Batch registration** — register multiple decorated classes at once:

```typescript
container.registerMany([Database, UserService, AuthService]);
```

> `registerMany` uses each class as both its own token and implementation. The classes must be decorated with `@Injectable()`, `@Singleton()`, `@Transient()`, or `@Scoped()`.

### Resolving Dependencies

```typescript
// Throws ProviderNotFoundError if not registered
const service = container.get(UserService);

// Identical to get()
const service = container.resolve(UserService);

// Check without throwing
if (container.has(UserService)) {
  const service = container.get(UserService);
}
```

### Aliases for Token and Provider Keys

The `provide` key is accepted as an alias for `token`, and `useToken` is accepted as an alias for `useExisting`. These follow patterns common in other frameworks:

```typescript
container.register({ provide: 'config', useValue: { port: 3000 } });
container.register({ provide: 'cfg', useToken: 'config' });
```

### Disposal

`dispose(token)` resolves the cached instance for that token and calls its cleanup method (`dispose`, `destroy`, or `close`) if one exists:

```typescript
class Connection {
  dispose() { /* close the connection */ }
}

container.register({ token: Connection, useClass: Connection, scope: 'singleton' });
container.get(Connection);

container.dispose(Connection); // calls instance.dispose()
```

`clear()` disposes all tracked instances and empties the container's instance cache:

```typescript
container.clear();
```

### Middleware

Middleware intercepts every resolution call. Call `ctx.next()` to proceed and optionally transform the result:

```typescript
container.use((ctx) => {
  console.log(`Resolving: ${String(ctx.token)}`);
  const instance = ctx.next();
  console.log(`Resolved: ${String(ctx.token)}`);
  return instance;
});
```

Multiple middleware are applied in registration order.

### Lifecycle Hooks

```typescript
container.on(({ type, token, instance }) => {
  if (type === 'create') {
    // Fired once when a new instance is constructed
    console.log(`Created: ${String(token)}`);
  }
  if (type === 'resolve') {
    // Fired on every resolution (including cache hits)
    console.log(`Resolved: ${String(token)}`);
  }
});
```

Event types: `'create'` | `'resolve'`

## Decorators

### Scope Decorators

**`@Injectable()`** — marks a class as injectable. Required when using `registerMany`. Uses the default scope (singleton):

```typescript
@Injectable()
class EmailService {}
```

**`@Singleton()`** — the same instance is returned on every resolution:

```typescript
@Singleton()
class AppConfig {}
```

**`@Transient()`** — a new instance is created on every resolution:

```typescript
@Transient()
class RequestContext {}
```

**`@Scoped()`** — the same instance is returned within the same container scope. Child containers get their own instance:

```typescript
@Scoped()
class UnitOfWork {}
```

### Injection Decorators

**`@Inject(Token)`** — injects a dependency by token into a constructor parameter or class property:

```typescript
@Injectable()
class OrderService {
  // Constructor injection
  constructor(@Inject(Database) private db: Database) {}
}

@Injectable()
class ReportService {
  // Property injection
  @Inject(Database)
  private db!: Database;
}
```

**`@Inject(Token, { optional: true })`** — the dependency is not required. If the token is not registered, the value is `undefined` rather than throwing:

```typescript
@Injectable()
class NotificationService {
  constructor(
    @Inject('SMTP_CLIENT', { optional: true }) private smtp?: SmtpClient
  ) {}
}

@Injectable()
class AuditService {
  @Inject('LOGGER', { optional: true })
  private logger?: Logger;
}
```

## Container Hierarchy

Child containers fall back to the parent for tokens they do not have registered themselves. Registering a token in a child overrides the parent only for that child:

```typescript
const parent = new DIContainer();
parent.register({ token: 'db', useValue: 'production-db' });

const child = parent.createChild();
child.register({ token: 'db', useValue: 'test-db' });

child.get('db');   // 'test-db'
parent.get('db');  // 'production-db'

// Tokens not overridden in child are resolved from parent
child.get('other-from-parent');
```

## Error Handling

The container throws typed errors for common failure modes:

```typescript
import {
  ProviderNotFoundError,
  CircularDependencyError,
  InvalidProviderError,
} from '@voltrix/injector';

try {
  container.get('UNREGISTERED');
} catch (e) {
  if (e instanceof ProviderNotFoundError) {
    console.error('Token not registered');
  }
}
```

| Error | When thrown |
|---|---|
| `ProviderNotFoundError` | `get()` or `resolve()` is called for a token that is not registered in the container or any parent |
| `CircularDependencyError` | A dependency cycle is detected during resolution (e.g., `A -> B -> A`) |
| `InvalidProviderError` | A registration is missing a required key (`token`/`provide`) or a provider type (`useClass`, `useValue`, `useFactory`, `useExisting`/`useToken`) |

## Complete Example

```typescript
import 'reflect-metadata';
import {
  DIContainer,
  Injectable,
  Singleton,
  Transient,
  Inject,
} from '@voltrix/injector';

const DB_URL = Symbol('DB_URL');

@Singleton()
class Database {
  constructor(@Inject(DB_URL) private url: string) {}
  query(sql: string) { return []; }
}

@Injectable()
class UserRepository {
  constructor(@Inject(Database) private db: Database) {}
  findAll() { return this.db.query('SELECT * FROM users'); }
}

@Transient()
class UserService {
  constructor(@Inject(UserRepository) private repo: UserRepository) {}
  listUsers() { return this.repo.findAll(); }
}

const container = new DIContainer();

container.register({ token: DB_URL, useValue: 'postgresql://localhost/app' });
container.registerMany([Database, UserRepository, UserService]);

// Middleware for logging
container.use((ctx) => {
  const start = Date.now();
  const result = ctx.next();
  console.log(`Resolved ${String(ctx.token)} in ${Date.now() - start}ms`);
  return result;
});

// Lifecycle hook
container.on(({ type, token }) => {
  if (type === 'create') console.log(`New instance: ${String(token)}`);
});

const service = container.get(UserService);
service.listUsers();

// Cleanup
container.clear();
```

## API Reference

### `DIContainer`

| Method | Description |
|---|---|
| `new DIContainer(parent?, options?)` | Create a container. Pass a parent to create a child. Pass `{ autoInject: true }` to enable type-based auto-injection. |
| `createChild()` | Create a child container that inherits this container's registrations. |
| `register(descriptor)` | Register a single provider. |
| `registerMany(classes)` | Batch-register an array of decorated classes. |
| `get(token)` | Resolve a token, throwing `ProviderNotFoundError` if not found. |
| `resolve(token)` | Alias for `get()`. |
| `has(token)` | Return `true` if the token is registered. |
| `dispose(token)` | Call `dispose()`, `destroy()`, or `close()` on the resolved instance. |
| `clear()` | Dispose and remove all instances. |
| `use(middleware)` | Register a resolution middleware. |
| `on(hook)` | Register a lifecycle hook. |

### Registration Descriptor Fields

| Field | Alias | Description |
|---|---|---|
| `token` | `provide` | The injection token (class, string, or symbol). |
| `useClass` | — | Class to instantiate. |
| `useValue` | — | Constant value to return. |
| `useFactory` | — | Function `(container) => value` called to produce the value. |
| `useExisting` | `useToken` | Token to delegate resolution to. |
| `scope` | — | `'singleton'` (default for decorated classes), `'transient'`, or `'scoped'`. |

## License

MIT
