# @voltrix/decorator

An advanced, experimental decorator system for **Voltrix**, inspired by the elegance of NestJS and Spring Boot, but engineered to have zero runtime overhead ($O(1)$ routing).

## Features

- **Declarative Web Controllers**: Declare HTTP controllers, routes, and method mappings declaratively via decorators (`@Controller`, `@GET`, `@POST`, `@PUT`, `@DELETE`, `@PATCH`).
- **Automatic Parameter Extraction**: Extract and validate request elements directly into your route handlers using `@Body`, `@Param`, `@Query`, and `@Header`.
- **Dependency Injection**: Seamless integration with `@voltrix/injector` to automatically resolve controller dependencies.
- **Recursive App Bootstrapping**: Modular structures through `@VoltrixApp` to automatically scan controllers, register dependency providers, and boot up servers.
- **Declarative Security**: Easily attach custom route metadata for guards and policies (e.g. `@Roles`, `@Scopes`, `@Public`).

## Installation

```bash
npm install @voltrix/decorator reflect-metadata
```

> **Note:** Make sure you import `reflect-metadata` exactly once at the entry point of your application.

## Usage Example

```typescript
import 'reflect-metadata';
import { Controller, GET, POST, Body, Param, createApplication } from '@voltrix/decorator';

@Controller('users')
class UserController {
  @GET('/:id')
  async getUser(@Param('id') id: string) {
    return { id, name: 'Zeno' };
  }

  @POST('/')
  async createUser(@Body() data: any) {
    return { success: true, created: data };
  }
}

// Automatic bootstrapping: resolves DI, registers routes, and boots the uWS server
createApplication({
  port: 3000,
  controllers: [UserController]
});
```

## License

MIT
