# @voltrix/mock

🎭 **Mock API toolkit for Voltrix** - Create realistic mock APIs for development, testing, and prototyping.

## Features

- ✅ **Easy Integration** - Works seamlessly with `@voltrix/express`
- 🎯 **Realistic Data** - Built-in generators for users, posts, products, orders, and more
- 🔧 **Flexible Configuration** - Customize responses, delays, status codes, and headers
- 🚀 **Quick Setup** - Pre-built API collections for common use cases
- 🎨 **Custom Schemas** - Generate data based on your own schemas
- 🌐 **CORS Support** - Built-in CORS handling for frontend development
- 📊 **Response Rotation** - Cycle through different responses for the same endpoint
- ⏱️ **Network Simulation** - Add delays to simulate real network conditions

## Installation

```bash
npm install @voltrix/mock @voltrix/express
```

## Quick Start

### 1. Simple Mock API

```typescript
import { voltrix } from '@voltrix/express';
import { createMockRouter, mockData } from '@voltrix/mock';

const app = voltrix();

// Create a mock router
const mockAPI = createMockRouter({ prefix: '/api' });

// Add mock endpoints
mockAPI
  .get('/users', { body: () => mockData.users(20) })
  .get('/users/:id', { 
    body: (req) => ({ 
      ...mockData.users(1)[0], 
      id: req.params.id 
    })
  })
  .post('/users', {
    status: 201,
    body: (req) => ({
      ...req.body,
      id: Date.now(),
      createdAt: new Date().toISOString()
    })
  });

// Mount the mock router
app.use(mockAPI.getRouter());

app.listen(3000, () => {
  console.log('Mock API running on http://localhost:3000');
});
```

### 2. Pre-built REST API

```typescript
import { voltrix } from '@voltrix/express';
import { createRESTAPI } from '@voltrix/mock';

const app = voltrix();

// Create a complete REST API with standard endpoints
const restAPI = createRESTAPI({
  prefix: '/api/v1',
  logging: true,
  cors: true
});

app.use(restAPI.getRouter());

app.listen(3000);

// Available endpoints:
// GET    /api/v1/users
// GET    /api/v1/users/:id  
// POST   /api/v1/users
// PUT    /api/v1/users/:id
// DELETE /api/v1/users/:id
// GET    /api/v1/posts
// GET    /api/v1/products
// GET    /api/v1/orders
// ... and more
```

### 3. Custom Data Generation

```typescript
import { mockData } from '@voltrix/mock';

// Use built-in generators
const users = mockData.users(50);
const products = mockData.products(30);
const orders = mockData.orders(25);

// Custom data with schema
const customData = mockData.custom({
  title: 'string',
  price: 'number', 
  email: 'email',
  createdAt: 'date',
  isActive: 'boolean'
}, 10);
```

## API Reference

### MockRouter

The main class for creating mock APIs:

```typescript
import { createMockRouter } from '@voltrix/mock';

const router = createMockRouter({
  prefix: '/api',     // Route prefix
  logging: true,      // Log requests
  cors: true,         // Enable CORS
  delay: 100,         // Global delay (ms)
  fallthrough: false  // Continue to next middleware on error
});
```

#### HTTP Methods

```typescript
router.get('/users', response);
router.post('/users', response);
router.put('/users/:id', response);
router.delete('/users/:id', response);
router.patch('/users/:id', response);
router.options('/users', response);
```

#### Response Types

```typescript
// Simple body
router.get('/simple', { body: 'Hello World' });

// Full response configuration
router.get('/full', {
  status: 200,
  headers: { 'X-Custom': 'value' },
  body: { message: 'Success' },
  delay: 500
});

// Dynamic response with request data
router.get('/dynamic', {
  body: (req) => ({
    path: req.path,
    query: req.query,
    timestamp: new Date().toISOString()
  })
});

// Response rotation
router.get('/rotating', [
  { body: { version: 'v1' } },
  { body: { version: 'v2' } },
  { body: { version: 'v3' } }
]);
```

### Mock Data Generators

Built-in generators for common data types:

```typescript
import { mockData } from '@voltrix/mock';

// Generate users (default: 10)
const users = mockData.users(25);

// Generate products  
const products = mockData.products(15);

// Generate posts
const posts = mockData.posts(20);

// Generate orders
const orders = mockData.orders(10);

// Generate companies
const companies = mockData.companies(5);

// Custom data with schema
const items = mockData.custom({
  name: 'string',
  age: 'number',
  email: 'email',
  phone: 'phone',
  website: 'url',
  active: 'boolean',
  createdAt: 'date',
  uuid: 'uuid'
}, 15);
```

### Quick Start Functions

Pre-built API configurations:

```typescript
import { createRESTAPI, createDemoAPI, createQuickAPI } from '@voltrix/mock';

// Full REST API
const restAPI = createRESTAPI({ prefix: '/api' });

// Demo/testing API  
const demoAPI = createDemoAPI({ prefix: '/demo' });

// Quick custom API
const quickAPI = createQuickAPI({
  '/hello': { message: 'Hello World' },
  '/users': mockData.users(10),
  '/slow': { 
    method: 'GET',
    response: { 
      body: 'Slow response', 
      delay: 2000 
    }
  }
});
```

## Advanced Usage

### Collections

Group related routes using collections:

```typescript
import { createMockRouter } from '@voltrix/mock';

const router = createMockRouter();

router.collection({
  name: 'User Management',
  baseUrl: '/users',
  routes: [
    {
      method: 'GET',
      path: '/',
      response: { body: () => mockData.users(20) },
      description: 'List all users'
    },
    {
      method: 'POST', 
      path: '/',
      response: {
        status: 201,
        body: (req) => ({ ...req.body, id: Date.now() })
      },
      description: 'Create new user'
    }
  ]
});
```

### Network Simulation

Simulate network conditions:

```typescript
// Global delay
const router = createMockRouter({ delay: 200 });

// Per-endpoint delay
router.get('/slow', { 
  body: 'This took 3 seconds',
  delay: 3000 
});

// Random delays
router.get('/random-delay', {
  body: 'Random delay',
  delay: () => Math.random() * 2000 // 0-2 seconds
});
```

### Error Simulation

Test error handling:

```typescript
router.get('/error', {
  status: 500,
  body: { error: 'Internal server error' }
});

router.get('/not-found', {
  status: 404, 
  body: { error: 'Resource not found' }
});

// Random errors
router.get('/flaky', {
  body: () => {
    if (Math.random() > 0.7) {
      return { status: 500, body: { error: 'Random failure' } };
    }
    return { message: 'Success' };
  }
});
```

## Integration Examples

### With React Development

```typescript
// server.ts
import { voltrix } from '@voltrix/express';
import { createRESTAPI } from '@voltrix/mock';

const app = voltrix();
const mockAPI = createRESTAPI({ 
  prefix: '/api',
  cors: true,
  logging: true 
});

app.use(mockAPI.getRouter());
app.listen(3001, () => {
  console.log('Mock API server running on http://localhost:3001');
});
```

```javascript
// In your React app
const response = await fetch('http://localhost:3001/api/users');
const users = await response.json();
```

### With Testing

```typescript
import { describe, it, expect } from 'vitest';
import { createMockRouter, mockData } from '@voltrix/mock';

describe('API Tests', () => {
  it('should return users', async () => {
    const router = createMockRouter();
    router.get('/users', { body: () => mockData.users(5) });
    
    // Test with your HTTP client
    // ...
  });
});
```

## TypeScript Support

Full TypeScript support with comprehensive type definitions:

```typescript
import type {
  MockRouter,
  MockRoute,
  MockResponse,
  MockCollection,
  DataSchema
} from '@voltrix/mock';
```

## Contributing

We welcome contributions! Please see our [Contributing Guide](../../CONTRIBUTING.md) for details.

## License

MIT © [Voltrix Team](https://github.com/zenozaga/voltrix)