# @voltrix/express

A hyper-optimized **Express.js** compatibility adapter and bridge built on top of **Voltrix**. It allows you to migrate existing Express applications to Voltrix without rewriting your codebase, boosting performance by **~4x to 10x** compared to pure Node.js + Express.

## Features

- **Express Compatibility**: Provides familiar and standard APIs like `req.json()`, `res.status().json()`, `res.send()`, and `app.use()`.
- **Frictionless Migration**: Reuses your existing middleware stack with the standard `(req, res, next)` signature.
- **Native Performance**: Delegates all heavy routing and middleware execution to the underlying `@voltrix/server` `PipelineRunner` and `RadixTree`. Benchmarks demonstrate that this adapter incurs only a 1-2% overhead compared to pure Voltrix Server!

## Installation

```bash
npm install @voltrix/express
```

## Usage Example

```typescript
import voltrix from '@voltrix/express';

const app = voltrix();

// Standard Express-style middleware
app.use((req, res, next) => {
  console.log(`[LOG] ${req.method} ${req.url}`);
  next();
});

// Familiar route declarations
app.get('/users/:id', (req, res) => {
  res.json({ id: req.getParam('id') });
});

app.post('/users', async (req, res) => {
  const body = await req.json();
  res.status(201).json({ created: true, data: body });
});

await app.listen(3000);
console.log('Listening on http://localhost:3000');
```

## License

MIT
