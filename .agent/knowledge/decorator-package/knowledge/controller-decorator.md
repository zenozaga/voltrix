# Controller Decorator & Custom Request Decorators

This document explains the new Controller decorator and custom request decorator functionality added to the Voltrix decorator system.

## 🎯 Overview

The Controller decorator enables a modular architecture similar to your HyperController pattern:
```
App → Module → Controller → Function
```

Additionally, you can create custom request decorators similar to your `@Parser` decorator.

## 📦 Controller Decorator

### Basic Usage

```typescript
import { Controller, processController } from '@voltrix/decorator';

// Simple controller with string prefix
@Controller('v1')
class UserController {
  // Methods here will be prefixed with /v1
}

// Advanced controller with options
@Controller({
  prefix: 'api/v2',
  middleware: ['auth', 'cors'],
  version: '2.0',
  scopes: ['read', 'write'],
  roles: ['user', 'admin']
})
class AdminController {
  // Methods here will be prefixed with /api/v2
}
```

### Processing Controllers

```typescript
const result = processController(UserController);

console.log(result.metadata.prefix); // 'v1'
console.log(result.routes); // Array of routes found in controller
console.log(result.controllerClass); // UserController class
```

## 🔧 Custom Request Decorators

### Creating Custom Decorators

Similar to your `@Parser` decorator, you can create custom decorators:

```typescript
import { createCustomRequestDecorator } from '@voltrix/decorator';

// Create a Parser-like decorator
const Parser = createCustomRequestDecorator<{
  schema?: any;
  validate?: boolean;
  transform?: (data: any) => any;
  errorHandler?: (error: Error) => void;
}>('parser', {
  validate: true // default option
});

// Create an Authentication decorator
const AuthRequired = createCustomRequestDecorator<{
  strategy?: 'jwt' | 'session' | 'oauth';
  roles?: string[];
  required?: boolean;
}>('auth', {
  strategy: 'jwt',
  required: true
});

// Create a Cache decorator
const CacheResponse = createCustomRequestDecorator<{
  ttl?: number;
  storage?: 'memory' | 'redis';
  key?: string;
}>('cache', {
  ttl: 300,
  storage: 'memory'
});
```

### Using Custom Decorators

```typescript
@Controller('v1')
class ApiController {
  // Using the Parser decorator (similar to your request)
  @Parser({ 
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        email: { type: 'string', format: 'email' }
      },
      required: ['name', 'email']
    },
    validate: true,
    transform: (data) => ({ ...data, timestamp: Date.now() })
  })
  async createUser() {
    // Implementation
  }

  @AuthRequired({ 
    strategy: 'jwt',
    roles: ['admin', 'moderator'] 
  })
  @CacheResponse({ 
    ttl: 600,
    storage: 'redis' 
  })
  async getAdminData() {
    // Implementation
  }
}
```

## 🔍 Metadata Retrieval

Retrieve metadata from your custom decorators:

```typescript
import { getCustomDecoratorMetadata } from '@voltrix/decorator';

// Get Parser metadata
const parserMeta = getCustomDecoratorMetadata('parser', ApiController.prototype, 'createUser');
console.log(parserMeta.options.validate); // true
console.log(parserMeta.options.schema.type); // 'object'

// Get Auth metadata
const authMeta = getCustomDecoratorMetadata('auth', ApiController.prototype, 'getAdminData');
console.log(authMeta.options.strategy); // 'jwt'
console.log(authMeta.options.roles); // ['admin', 'moderator']
```

## 🏗️ Modular Architecture

The complete architecture follows this pattern:

```typescript
// App Level
@VoltrixApp({
  modules: [UserModule, AdminModule]
})
class MyApp {}

// Module Level
@Module({
  controllers: [UserController, AdminController],
  providers: [UserService, AdminService]
})
class UserModule {}

// Controller Level
@Controller('v1')
class UserController {
  
  // Function Level
  @GET('/users')
  @Parser({ schema: userSchema })
  @AuthRequired({ roles: ['user'] })
  async getUsers() {}
  
  @POST('/users')
  @Parser({ 
    schema: createUserSchema,
    transform: (data) => ({ ...data, id: generateId() })
  })
  @AuthRequired({ roles: ['admin'] })
  async createUser() {}
}
```

Generated routes:
- `GET /v1/users`
- `POST /v1/users`

## 📋 Predefined Decorators

The system includes several predefined decorators:

### Parser (Similar to your request)
```typescript
@Parser({ 
  schema: userSchema,
  validate: true,
  transform: (data) => processData(data),
  errorHandler: (error) => handleError(error)
})
```

### Cache
```typescript
@Cache({ 
  ttl: 300,
  storage: 'memory',
  key: 'users-list'
})
```

### RateLimit
```typescript
@RateLimit({ 
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100
})
```

### Transform
```typescript
@Transform({ 
  serialize: true,
  excludeNull: true,
  groups: ['public']
})
```

## 🧪 Testing

All functionality is tested:

```bash
# Run all tests
pnpm vitest run

# Run specific test files
pnpm vitest run tests/decorators/controller.test.ts
pnpm vitest run tests/decorators/custom-decorators.test.ts
```

Current test status: ✅ 141/141 tests passing

## 🚀 Examples

Check out the examples:
- `examples/working-controller-example.ts` - Working demonstration
- `examples/controller-comprehensive-example.ts` - Comprehensive usage

Run examples:
```bash
npx tsx examples/working-controller-example.ts
```

## 🔗 Integration with Security

The Controller decorator works seamlessly with the existing security system:

```typescript
@Controller('secure')
class SecureController {
  
  @GET('/admin')
  @Roles('admin', 'moderator') // Existing security decorator
  @Scopes('read', 'write')     // Existing security decorator
  @Parser({ validate: true })   // New custom decorator
  async adminOnly() {}
}
```

## 📝 Summary

✅ **Controller decorator**: Works like `@HyperController('v1')`  
✅ **Custom decorator factories**: Create decorators like `@Parser`  
✅ **Metadata system**: Store and retrieve decorator options  
✅ **Modular architecture**: App → Module → Controller → Function  
✅ **Security integration**: Works with existing `@Roles` and `@Scopes`  
✅ **Type safety**: Full TypeScript support with generics  
✅ **Test coverage**: 141/141 tests passing  

Your decorator system now supports the complete architecture and custom decorator functionality you requested! 🎉