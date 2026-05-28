# @voltrix/injector

A robust, ultra-fast, and lightweight Dependency Injection (DI) container with full support for `reflect-metadata` and class-based decorators.

## Features

- **Automatic Constructor Injection**: Inject services, repositories, and configurations cleanly into your controllers.
- **Multiple Lifecycles Supported**: Manage provider lifetimes with ease (`SINGLETON`, `TRANSIENT`, `SCOPED`).
- **Dependency Graph Resolution**: Fast, cached dependency resolution designed to handle complex provider trees with zero overhead.
- **Web-Agnostic Core**: Completely detached from any web framework; can be used as a general-purpose IoC container anywhere.

## Installation

```bash
npm install @voltrix/injector reflect-metadata
```

> **Note:** Remember to import `reflect-metadata` once at your application's entry point.

## Usage Example

```typescript
import 'reflect-metadata';
import { Injectable, DIContainer } from '@voltrix/injector';

@Injectable()
class DatabaseService {
  connect() { return "Connected to DB!"; }
}

@Injectable()
class UserService {
  constructor(private readonly db: DatabaseService) {}

  getUser() {
    return `User fetched. DB Status: ${this.db.connect()}`;
  }
}

// Manual resolution (usually '@voltrix/decorator' handles this bootstrap for you)
const container = new DIContainer();
container.addProvider(DatabaseService);
container.addProvider(UserService);

const userService = container.resolve(UserService);
console.log(userService.getUser());
```

## License

MIT
