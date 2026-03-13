# Voltrix Express App Template

## Overview
Complete template for creating high-performance Express-compatible applications using the Voltrix framework.

## Basic App Template

```typescript
// src/app.ts
import { App, Request, Response, NextFunction } from '@voltrix/express';

export function createVoltrixApp() {
  const app = new App();

  // Global middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    // Add request ID for tracing
    req.id = Math.random().toString(36).substring(7);
    
    // Add CORS headers
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    next();
  });

  // Request logging middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(`${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
    });
    
    next();
  });

  // Health check endpoint
  app.get('/health', (req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage()
    });
  });

  // API routes
  setupAPIRoutes(app);
  
  // Error handling middleware
  app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
    console.error('Application Error:', error);
    
    if (res.finished) return;
    
    res.status(500).json({
      error: 'Internal Server Error',
      requestId: req.id,
      timestamp: new Date().toISOString()
    });
  });

  return app;
}

function setupAPIRoutes(app: App) {
  // User routes
  app.get('/api/users', async (req: Request, res: Response) => {
    const users = await getUsersFromDatabase();
    res.json(users);
  });

  app.get('/api/users/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    const user = await getUserById(id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user);
  });

  app.post('/api/users', async (req: Request, res: Response) => {
    try {
      const userData = await parseRequestBody(req);
      const newUser = await createUser(userData);
      res.status(201).json(newUser);
    } catch (error) {
      res.status(400).json({ error: 'Invalid user data' });
    }
  });

  app.put('/api/users/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    const userData = await parseRequestBody(req);
    
    const updatedUser = await updateUser(id, userData);
    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(updatedUser);
  });

  app.delete('/api/users/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    const deleted = await deleteUser(id);
    
    if (!deleted) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.status(204).send();
  });
}

// Database mock functions (replace with real implementation)
async function getUsersFromDatabase() {
  return [
    { id: 1, name: 'John Doe', email: 'john@example.com' },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com' }
  ];
}

async function getUserById(id: string) {
  const users = await getUsersFromDatabase();
  return users.find(user => user.id === parseInt(id));
}

async function createUser(userData: any) {
  return {
    id: Math.floor(Math.random() * 1000),
    ...userData
  };
}

async function updateUser(id: string, userData: any) {
  return {
    id: parseInt(id),
    ...userData
  };
}

async function deleteUser(id: string) {
  return true; // Mock successful deletion
}

async function parseRequestBody(req: Request): Promise<any> {
  // In a real implementation, you would parse the request body
  // This is a placeholder for body parsing functionality
  return {};
}
```

## Production App Template

```typescript
// src/production-app.ts
import { App, Request, Response, NextFunction } from '@voltrix/express';
import { rateLimit } from '@voltrix/middleware';
import { logger } from './utils/logger';
import { metrics } from './utils/metrics';

export function createProductionApp() {
  const app = new App();

  // Production middleware stack
  app.use(securityHeaders);
  app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 })); // Rate limiting
  app.use(requestLogger);
  app.use(metricsCollector);
  app.use(requestValidator);

  // Health and monitoring endpoints
  app.get('/health', healthCheck);
  app.get('/metrics', metricsEndpoint);
  app.get('/ready', readinessCheck);

  // API routes with authentication
  app.use('/api', authenticationMiddleware);
  setupSecureAPIRoutes(app);

  // Global error handler
  app.use(errorHandler);

  return app;
}

// Security middleware
function securityHeaders(req: Request, res: Response, next: NextFunction) {
  res.set('X-Frame-Options', 'DENY');
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-XSS-Protection', '1; mode=block');
  res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
}

// Request logging
function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('Request processed', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });
  });
  
  next();
}

// Metrics collection
function metricsCollector(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    metrics.recordRequest(req.method, req.path, res.statusCode, duration);
  });
  
  next();
}

// Request validation
function requestValidator(req: Request, res: Response, next: NextFunction) {
  // Validate request size, content type, etc.
  const contentLength = parseInt(req.get('content-length') || '0');
  if (contentLength > 10 * 1024 * 1024) { // 10MB limit
    return res.status(413).json({ error: 'Payload too large' });
  }
  
  next();
}

// Authentication middleware
function authenticationMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.get('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  const token = authHeader.substring(7);
  
  try {
    // Validate JWT token (implement your validation logic)
    const user = validateJWT(token);
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// Health checks
function healthCheck(req: Request, res: Response) {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION || '1.0.0',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV || 'development'
  });
}

function metricsEndpoint(req: Request, res: Response) {
  res.set('Content-Type', 'text/plain');
  res.send(metrics.getPrometheusMetrics());
}

function readinessCheck(req: Request, res: Response) {
  // Check database connectivity, external services, etc.
  const checks = {
    database: checkDatabase(),
    redis: checkRedis(),
    externalAPI: checkExternalServices()
  };
  
  const allHealthy = Object.values(checks).every(check => check.healthy);
  
  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'ready' : 'not ready',
    checks
  });
}

// Error handling
function errorHandler(error: Error, req: Request, res: Response, next: NextFunction) {
  logger.error('Application error', {
    error: error.message,
    stack: error.stack,
    method: req.method,
    path: req.path,
    requestId: req.id
  });
  
  if (res.finished) return;
  
  // Don't expose internal errors in production
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal Server Error' 
    : error.message;
  
  res.status(500).json({
    error: message,
    requestId: req.id,
    timestamp: new Date().toISOString()
  });
}

// Mock functions (implement with real services)
function validateJWT(token: string): any {
  // JWT validation logic
  return { id: 1, email: 'user@example.com' };
}

function checkDatabase(): { healthy: boolean; latency?: number } {
  // Database health check
  return { healthy: true, latency: 5 };
}

function checkRedis(): { healthy: boolean; latency?: number } {
  // Redis health check
  return { healthy: true, latency: 2 };
}

function checkExternalServices(): { healthy: boolean; latency?: number } {
  // External services health check
  return { healthy: true, latency: 50 };
}

function setupSecureAPIRoutes(app: App) {
  // Implement your secure API routes here
  app.get('/api/profile', (req: Request, res: Response) => {
    res.json({ user: req.user });
  });
}
```

## Microservice Template

```typescript
// src/microservice-app.ts
import { App } from '@voltrix/express';
import { ServiceRegistry } from './utils/service-registry';
import { CircuitBreaker } from './utils/circuit-breaker';

export function createMicroserviceApp(serviceName: string) {
  const app = new App();
  const serviceRegistry = new ServiceRegistry();
  
  // Service discovery and registration
  app.use(serviceDiscoveryMiddleware(serviceName, serviceRegistry));
  
  // Circuit breaker for external service calls
  app.use(circuitBreakerMiddleware);
  
  // Distributed tracing
  app.use(tracingMiddleware);
  
  // Service-specific routes
  setupServiceRoutes(app, serviceName);
  
  return app;
}

function serviceDiscoveryMiddleware(serviceName: string, registry: ServiceRegistry) {
  return async (req: Request, res: Response, next: NextFunction) => {
    req.services = registry;
    next();
  };
}

function circuitBreakerMiddleware(req: Request, res: Response, next: NextFunction) {
  req.circuitBreaker = new CircuitBreaker();
  next();
}

function tracingMiddleware(req: Request, res: Response, next: NextFunction) {
  req.traceId = generateTraceId();
  res.set('X-Trace-ID', req.traceId);
  next();
}

function setupServiceRoutes(app: App, serviceName: string) {
  // Service-specific implementation
}

function generateTraceId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}
```

## Usage Examples

```typescript
// Basic usage
import { createVoltrixApp } from './templates/express-app-template';

const app = createVoltrixApp();
app.listen(3000, (success) => {
  if (success) {
    console.log('Voltrix app listening on port 3000');
  }
});

// Production usage
import { createProductionApp } from './templates/express-app-template';

const prodApp = createProductionApp();
prodApp.listen(process.env.PORT || 3000);

// Microservice usage
import { createMicroserviceApp } from './templates/express-app-template';

const userService = createMicroserviceApp('user-service');
userService.listen(3001);
```