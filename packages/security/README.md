# @voltrix/security

High-performance, zero-allocation, and distributed security suite natively optimized for `uWebSockets.js` and `@voltrix/server`. 

Voltrix Security bridges standard Express-like middleware with Voltrix's native plugin architecture, executing security controls on pre-compiled hot paths with absolute minimum overhead.

---

## 🏗️ Core Modules

1. **`IP Filter` (Radix CIDR Firewall)**: Compiles blacklists/whitelists of IPv4/IPv6 CIDR ranges (e.g. `192.168.1.0/24`) into optimized Radix Tree structures. Matches IPs in $O(k)$ time complexity (independent of blacklist size) and terminates unauthorized TCP streams instantly in the upgrade/request phase.
2. **`CORS` (OPTIONS Preflight Short-circuit)**: Pre-compiles dynamic origin matching and handles `OPTIONS` preflight requests directly at the C++ server boundary, short-circuiting routing and controller instantiation.
3. **`Helmet` (Zero-Overhead Header Pre-Baking)**: Construct and pre-bakes static security headers (CSP, HSTS, X-Frame-Options, etc.) into a frozen byte buffer at startup, achieving **0% per-request CPU overhead** during flushes.
4. **`Rate Limiter` (Sliding Window)**: High-concurrency sliding window rate limiter backed by high-performance local memory sweeps or distributed atomic **Redis Lua Scripts**.
5. **`CSRF Protection` (Double Submit Cookie)**: Timing-attack safe protector using cryptographically secure tokens, secure cookies, and `crypto.timingSafeEqual` header validations.
6. **`Encrypted Sessions` (AES-256-GCM)**: Symmetric authenticated cookie encryption (confidentiality and integrity guaranteed; client cannot decipher or modify session data). Employs non-blocking, fire-and-forget background state saves.

---

## 📦 Installation

```bash
npm install @voltrix/security ioredis
```

---

## 🛠️ Hybrid Storage Configuration

Voltrix Security uses pluggable storage backends for Rate Limiting and Session states:

### 1. In-Memory Store (Single-node / Local)
Uses circular ring arrays for timestamp sweeps, completely eliminating V8 Garbage Collector churn:
```typescript
import { MemoryStore } from '@voltrix/security';
const store = new MemoryStore({ sweepIntervalMs: 60000 });
```

### 2. Redis Store (Distributed / Clustered)
Synchronizes session and rate limits atomically across a cluster of multiple servers:
```typescript
import { RedisStore } from '@voltrix/security';
const store = new RedisStore({ host: '127.0.0.1', port: 6379 });
```

---

## 🚀 Usage Guide

### 1. Programmatic Middleware Setup (Express & Server core)
Register security modules globally in your Voltrix application:

```typescript
import { createServer } from '@voltrix/server';
import { security, RedisStore } from '@voltrix/security';

const server = createServer();

server.register(security({
  // Pre-baked security headers
  helmet: {
    contentSecurityPolicy: "default-src 'self'",
    frameguard: 'deny'
  },
  // Sub-millisecond preflight CORS interceptor
  cors: {
    origin: ['https://app.voltrix.com', 'https://admin.voltrix.com'],
    credentials: true
  },
  // CIDR Radix Firewall
  ipFilter: {
    whitelist: ['10.0.0.0/8', '192.168.1.0/24'],
    onFail: (req, res) => res.status(403).send('Access Denied')
  },
  // Sliding-window rate limiter
  rateLimit: {
    limit: 100,
    windowMs: 60000,
    store: new RedisStore({ host: '127.0.0.1', port: 6379 }) // Clustered rate limiting!
  },
  // AES-256-GCM Encrypted Sessions
  session: {
    secret: 'super-secure-32-character-long-secret-key-!!!',
    cookieName: 'vltx_sid',
    store: new RedisStore({ host: '127.0.0.1', port: 6379 }) // Distributed session sharing!
  }
}));

server.get('/dashboard', (ctx) => {
  // Read and write session data securely
  const session = ctx.locals.session;
  session.views = (session.views || 0) + 1;
  
  return ctx.json({ views: session.views });
});

await server.listen({ port: 3000 });
```

---

### 2. Decorator Setup (DX Gateway Controllers)
You can selectively restrict endpoints or classes using declarative TypeScript decorators:

```typescript
import { Controller, GET } from '@voltrix/decorator';
import { RateLimit, IpFilter } from '@voltrix/security';

@Controller('admin')
@IpFilter({ whitelist: ['10.0.0.0/8'] }) // Only allow internal CIDR IPs
export class AdminController {

  @GET('/financials')
  @RateLimit({ limit: 5, windowMs: 60000 }) // Strictly restrict access frequency
  async getFinancials() {
    return { revenue: 1000000 };
  }
}
```
