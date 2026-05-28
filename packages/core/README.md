# @voltrix/core

This package contains the fundamental types, interfaces, and base utilities shared across the entire **Voltrix** ecosystem. Its primary goal is to enforce strict Type Safety throughout all monorepo packages while avoiding circular dependencies.

## What is it for?

- **Interface Definitions**: Defines core framework interfaces such as `IRequest`, `IResponse`, `AppTree`, `ModuleNode`, and more.
- **Dependency Injection & Decorators Support**: Exports utility types utilized by the `@voltrix/injector` dependency injection container and `@voltrix/decorator` declarations.
- **Contract Source of Truth**: Serves as the single source of truth for interface contracts between `@voltrix/server` and `@voltrix/express`.

## Installation

Typically, you do not need to install this package directly unless you are building a custom plugin or a third-party extension for the Voltrix ecosystem.

```bash
npm install @voltrix/core
```

## Usage Example

If you are developing a tool or middleware that interacts with the Voltrix core context:

```typescript
import { IRequest, IResponse } from '@voltrix/core';

export function myCustomMiddleware(req: IRequest, res: IResponse, next: () => void) {
  console.log(`Incoming request to: ${req.url}`);
  next();
}
```

## License

MIT
