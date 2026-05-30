# 🔐 `@voltrix/security`

High-performance, zero-allocation, distributed security suite natively optimized for `uWebSockets.js` and `@voltrix/server`.

---

## 🚀 Overview

`@voltrix/security` is a production-grade security package designed from the ground up for extreme throughput and minimal latency. By combining pre-compiled structures, startup-baked security configurations, and zero-allocation hot paths, it adds virtually **0% framework overhead** while providing complete protection against common web vulnerabilities.

It implements 6 robust, state-of-the-art security modules that can be registered globally or declaratively via decorators.

### 🛡️ Features

1. **Helmet**: Pre-baked static HTTP security headers (CSP, HSTS, CSP, X-Frame) compiled at startup into frozen arrays for zero-allocation flushes.
2. **CORS**: dynamic pre-normalized cross-origin protection with sub-millisecond OPTIONS preflight short-circuiting.
3. **Rate Limiting**: IP-based or proxy-aware sliding window limiter with support for local `MemoryStore` or distributed `RedisStore` atomic Lua scripts.
4. **IP Filter**: Nanosecond-level binary IPv4/IPv6 CIDR bitwise firewall supporting Whitelists and Blacklists with early connection termination.
5. **CSRF**: Timing-attack safe Double Submit Cookie pattern using authenticated base64url cookies and timingSafeEqual header verification.
6. **Sessions**: Cookie-based stateful and stateless session containers secured via AES-256-GCM authenticated encryption with automatic response save interception.

---

## 📦 Installation

```bash
npm install @voltrix/security
# or
pnpm add @voltrix/security
```

---

## 🛠️ Usage

### Global Integration

The package exposes a unified `security` middleware factory that acts both as a standard middleware and a native `VoltrixPlugin`. It chains active security modules in the optimal execution order: **IP Filter ➔ CORS ➔ Helmet ➔ Rate Limiter ➔ CSRF ➔ Sessions**.

```typescript
import { createServer } from '@voltrix/server';
import { security, RedisStore } from '@voltrix/security';

const server = createServer();

// Register the security suite globally
server.register(security({
  helmet: true,
  cors: {
    origin: ['https://app.voltrix.com', 'https://admin.voltrix.com'],
    credentials: true,
  },
  rateLimit: {
    limit: 100,
    windowMs: 60000,
    store: new RedisStore({ host: '127.0.0.1', port: 6379 }) // Clustered sliding-window!
  },
  ipFilter: {
    blacklist: ['192.168.1.0/24', '10.0.0.0/8'] // Block internal CIDR blocks
  },
  csrf: true,
  session: {
    secret: 'super-secure-cryptographic-signing-key-32chars',
    cookieName: 'voltrix_session',
    ttlMs: 86400000 // 24h
  }
}));
```

### Declarative Route-level Decorators

Apply granular restrictions to specific Controllers or route methods using declarative class and method decorators.

```typescript
import { Controller, GET, POST } from '@voltrix/decorator';
import { RateLimit, IpFilter } from '@voltrix/security';

@Controller('admin')
@IpFilter({ whitelist: ['10.0.0.0/8', '127.0.0.1'] }) // CIDR-filtered admin panel
export class AdminController {
  
  @GET('/logs')
  @RateLimit({ limit: 5, windowMs: 60000 }) // Strictly rate-limited endpoint
  async getLogs() {
    return { logs: ['Server booted successfully'] };
  }
}
```

---

## 📖 Module Reference & Options

### 1. IP Filter
Nanosecond bitwise matcher for IPv4 CIDRs and IPv6 exact ranges. It operates in the earliest hook and closes the underlying socket instantly if blacklisted, saving CPU cycles under DDoS.

* **whitelist**: String array of permitted ranges. If specified, only matches here will pass.
* **blacklist**: String array of prohibited ranges.
* **handler**: Custom block handler `(req, res) => void`.

### 2. CORS
Intercepts preflight `OPTIONS` requests before they hit the app router.
* **origin**: Allowlist origins (string, array of strings, or a dynamic async function `(origin) => boolean`).
* **methods**: Allowed HTTP methods.
* **allowedHeaders** / **exposedHeaders**: Custom headers array.
* **credentials**: Enables Cookies over CORS.
* **maxAge**: Cache lifetime in seconds.

### 3. Helmet
Pre-renders HSTS, CSP, X-Frame-Options, X-Content-Type, and Referrer headers.
* **csp**: CSP Directives object.
* **hsts**: HSTS settings (maxAge, includeSubDomains, preload).
* **xFrame**: 'DENY' or 'SAMEORIGIN'.
* **xContentType**: Boolean (defaults to `nosniff`).

### 4. Rate Limiting
Proxy-aware rate counter.
* **limit**: Max requests in the window.
* **windowMs**: Window length in milliseconds.
* **store**: Store instance (defaults to local map-based `MemoryStore`).
* **keyGenerator**: Custom client key resolution `(req) => string`.

### 5. CSRF
Timing-safe Double Submit Cookie validator.
* **cookieName** / **headerName**: Defaults to `_csrf` and `x-csrf-token`.
* **ignoreMethods**: Methods exempted (defaults to `['GET', 'HEAD', 'OPTIONS']`).

### 6. Sessions
AES-256-GCM cookie session container with zero-cost response hijacking (json/send/end) and fire-and-forget background state saves.
* **secret**: 32-byte signing key.
* **cookieName**: Default session cookie name.
* **ttlMs**: Time to live.
* **store**: Optional stateful session store (defaults to stateless GCM cookie session).

---

## 🚀 Performance Guidelines

* Use **`MemoryStore`** for single-instance applications where zero latency is the ultimate goal.
* Use **`RedisStore`** for horizontally-scalable, multi-node clustered servers. It runs sliding-window increments atomically using dedicated custom Lua scripts to prevent racing conditions under extreme loads.
* The Helmet module pre-renders headers at startup, making its per-request impact exactly **0% CPU**.

---

## 📄 License

MIT
