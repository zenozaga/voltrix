# @voltrix/express

Ultra-fast Express-compatible framework with Direct Actions system for O(1) parameter routing.

## 🚀 Features

### Core Router
- **Traditional routing** - Full Express compatibility
- **Direct Actions** - O(1) parameter-based routing  
- **Automatic conversion** - Dynamic routes become direct actions
- **Performance optimized** - 200%+ faster parameter access

### Direct Actions System

Convert dynamic routes like `/user/details/:id/:type` to direct O(1) access:

```typescript
import { Router } from '@voltrix/express';

const router = new Router();

// Traditional route (automatically creates Direct Action)
router.get('/user/details/:id/:type', (req, res) => {
  res.json({ id: req.params.id, type: req.params.type });
});

// Access via Direct Action URL (O(1) lookup)
// GET /user/details?param[id]=123&param[type]=admin
```

## 📊 Performance

- **Traditional Routing**: ~937K ops/sec
- **Direct Actions**: ~2.8M ops/sec  
- **Improvement**: 201.6% faster

## 🔧 API

### Router Methods

```typescript
// Standard HTTP methods (auto-create Direct Actions)
router.get(pattern, handler)
router.post(pattern, handler)
router.put(pattern, handler)
router.delete(pattern, handler)

// Direct Action utilities
router.generateDirectUrl(method, pattern, params)
router.hasDirectAction(method, pattern)
```

### URL Generation

```typescript
const directUrl = router.generateDirectUrl('GET', '/user/details/:id/:type', {
  id: '123',
  type: 'admin'
});
// Returns: "/user/details?param[id]=123&param[type]=admin"
```

## 🏗️ Architecture

- **router.ts** - Core router with Direct Actions
- **app.ts** - Express-compatible application  
- **request.ts/response.ts** - HTTP abstractions
- **types.ts** - TypeScript definitions

## ✅ Testing

```bash
# Run Direct Actions tests
node tests/direct-actions.test.mjs

# Results: 7/7 tests passing with performance benchmarks
```

The system provides both traditional Express routing and ultra-fast O(1) parameter access through Direct Actions, maintaining full compatibility while delivering exceptional performance.