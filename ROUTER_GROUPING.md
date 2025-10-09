# 📁 Router Grouping en Voltrix

## 🚀 Introducción

Voltrix soporta **router grouping** similar a Express, permitiendo organizar rutas y middleware de forma modular y escalable. Esta funcionalidad es ideal para aplicaciones grandes donde necesitas agrupar rutas relacionadas.

## 📖 Conceptos Básicos

### ¿Qué es un Router?
Un **Router** es una instancia mini-aplicación que puede contener:
- ✅ Rutas HTTP (GET, POST, PUT, DELETE, etc.)
- ✅ Middlewares específicos
- ✅ Otros routers anidados
- ✅ Configuración modular

### Ventajas del Router Grouping
- 🎯 **Organización**: Separar lógica por módulos
- 🔒 **Middleware específico**: Aplicar middleware solo a ciertas rutas
- 🏗️ **Escalabilidad**: Facilita el crecimiento de la aplicación
- 🔄 **Reutilización**: Routers reutilizables entre proyectos
- 🧹 **Mantenibilidad**: Código más limpio y organizados

## 🛠️ API Reference

### Crear un Router

```typescript
import { createRouter } from '@voltrix/express';

const router = createRouter();
```

### Métodos de Router

#### HTTP Methods
```typescript
router.get(path, handler)     // GET route
router.post(path, handler)    // POST route
router.put(path, handler)     // PUT route
router.delete(path, handler)  // DELETE route
router.patch(path, handler)   // PATCH route
router.options(path, handler) // OPTIONS route
router.head(path, handler)    // HEAD route
```

#### Middleware
```typescript
// Middleware global para el router
router.use(middleware)

// Middleware específico para un path
router.use('/path', middleware)

// Montar otro router
router.use('/nested', anotherRouter)
```

### Montar Router en la App

```typescript
import { App, createRouter } from '@voltrix/express';

const app = new App();
const usersRouter = createRouter();

// Definir rutas en el router
usersRouter.get('/', handler);
usersRouter.get('/:id', handler);

// Montar el router en la app
app.use('/users', usersRouter);
// Resultado: GET /users/, GET /users/:id
```

## 📝 Ejemplos Prácticos

### 1. Router Básico - Usuarios

```typescript
const usersRouter = createRouter();

// Middleware específico para usuarios
usersRouter.use((req, res, next) => {
  console.log('Users middleware executed');
  // Autenticación, logging, etc.
  next();
});

// Rutas de usuarios
usersRouter.get('/', (req, res) => {
  res.json({ message: 'List all users' });
});

usersRouter.get('/:id', (req, res) => {
  res.json({ user: { id: req.params.id } });
});

usersRouter.post('/', (req, res) => {
  res.status(201).json({ message: 'User created' });
});

// Montar en la app
app.use('/users', usersRouter);
```

### 2. Router con Middleware de Autenticación

```typescript
const adminRouter = createRouter();

// Middleware de autenticación
adminRouter.use((req, res, next) => {
  const token = req.headers.authorization;
  
  if (!token || !isValidAdmin(token)) {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  
  next();
});

// Rutas protegidas
adminRouter.get('/dashboard', (req, res) => {
  res.json({ message: 'Admin Dashboard' });
});

adminRouter.get('/logs', (req, res) => {
  res.json({ logs: getSystemLogs() });
});

app.use('/admin', adminRouter);
```

### 3. Routers Anidados

```typescript
// Router padre: Posts
const postsRouter = createRouter();

postsRouter.get('/', (req, res) => {
  res.json({ posts: getAllPosts() });
});

postsRouter.get('/:id', (req, res) => {
  res.json({ post: getPost(req.params.id) });
});

// Router hijo: Comments  
const commentsRouter = createRouter();

commentsRouter.get('/', (req, res) => {
  const postId = req.params.postId; // Heredado del router padre
  res.json({ comments: getComments(postId) });
});

commentsRouter.post('/', (req, res) => {
  const postId = req.params.postId;
  res.json({ message: 'Comment created', postId });
});

// Anidar router de comentarios en posts
postsRouter.use('/:postId/comments', commentsRouter);

// Montar en app
app.use('/posts', postsRouter);

// Resultado:
// GET /posts - Lista de posts
// GET /posts/:id - Post específico  
// GET /posts/:postId/comments - Comentarios del post
// POST /posts/:postId/comments - Crear comentario
```

### 4. Router con Versionado de API

```typescript
// API v1
const apiV1 = createRouter();

apiV1.use((req, res, next) => {
  res.setHeaders({ 'X-API-Version': '1.0.0' });
  next();
});

apiV1.get('/users', (req, res) => {
  res.json({ version: 'v1', users: [] });
});

// API v2  
const apiV2 = createRouter();

apiV2.use((req, res, next) => {
  res.setHeaders({ 'X-API-Version': '2.0.0' });
  next();
});

apiV2.get('/users', (req, res) => {
  res.json({ 
    version: 'v2', 
    users: [],
    pagination: { page: 1, limit: 10 }
  });
});

// Montar versiones
app.use('/api/v1', apiV1);
app.use('/api/v2', apiV2);
```

## 🏗️ Patrones de Organización

### Estructura de Archivos Recomendada

```
src/
├── routes/
│   ├── users/
│   │   ├── index.ts      // Router principal
│   │   ├── auth.ts       // Middleware de auth
│   │   └── handlers.ts   // Route handlers
│   ├── posts/
│   │   ├── index.ts
│   │   ├── comments.ts   // Router anidado
│   │   └── handlers.ts
│   └── admin/
│       ├── index.ts
│       └── middleware.ts
├── middleware/
│   ├── auth.ts
│   ├── logging.ts
│   └── validation.ts
└── app.ts                // App principal
```

### Ejemplo de Organización

```typescript
// src/routes/users/index.ts
import { createRouter } from '@voltrix/express';
import { authMiddleware } from './auth.js';
import { getUsersHandler, getUserHandler } from './handlers.js';

export const usersRouter = createRouter();

usersRouter.use(authMiddleware);
usersRouter.get('/', getUsersHandler);
usersRouter.get('/:id', getUserHandler);
```

```typescript
// src/app.ts
import { App } from '@voltrix/express';
import { usersRouter } from './routes/users/index.js';
import { postsRouter } from './routes/posts/index.js';
import { adminRouter } from './routes/admin/index.js';

const app = new App();

// Montar routers
app.use('/users', usersRouter);
app.use('/posts', postsRouter);  
app.use('/admin', adminRouter);

export { app };
```

## 🚀 Demo Live

Tenemos un **servidor demo funcionando** en `http://127.0.0.1:3001` que demuestra:

### Endpoints Disponibles:

1. **Main Demo**: `GET /` - Página principal con información
2. **Users Router**: 
   - `GET /users` - Lista de usuarios (con middleware de auth)
   - `GET /users/:id` - Usuario específico
   - `POST /users` - Crear usuario
3. **Posts Router**:
   - `GET /posts` - Lista de posts
   - `GET /posts/:id` - Post específico
   - `GET /posts/:id/comments` - Comentarios (router anidado)
   - `POST /posts/:id/comments` - Crear comentario
4. **Admin Router** (requiere auth):
   - `GET /admin/dashboard` - Dashboard de admin
   - `GET /admin/logs` - Logs del sistema
5. **API Router**:
   - `GET /api/health` - Health check
   - `GET /api/version` - Información de versión

### Probar los Endpoints:

```bash
# Demo principal
curl http://127.0.0.1:3001/

# Users (con middleware)
curl http://127.0.0.1:3001/users
curl http://127.0.0.1:3001/users/123

# Posts con comentarios anidados
curl http://127.0.0.1:3001/posts
curl http://127.0.0.1:3001/posts/1/comments

# Admin (requiere autenticación simulada)
curl http://127.0.0.1:3001/admin/dashboard

# API
curl http://127.0.0.1:3001/api/health
```

## 🎯 Mejores Prácticas

### 1. **Modularidad**
- Un router por funcionalidad (users, posts, admin)
- Separar middleware en archivos independientes
- Handlers en archivos dedicados

### 2. **Middleware Strategy**
- Middleware específico en el router correspondiente
- Middleware común a nivel de app
- Middleware de autenticación por router según necesidad

### 3. **Path Naming**
- Paths descriptivos y RESTful
- Consistencia en naming conventions
- Versioning para APIs (`/api/v1`, `/api/v2`)

### 4. **Error Handling**
- Error handlers específicos por router si es necesario
- Global error handler en la app principal
- Consistent error response format

### 5. **Performance**
- Middleware cache habilitado por defecto
- Route complexity optimization automática
- LRU cache para rutas frecuentes

## 🔧 Configuración Avanzada

### Router con Opciones Personalizadas

```typescript
const router = createRouter();

// Obtener estadísticas del router
const stats = router.getStats();
console.log(stats); // { routes: 5, middlewares: 2 }

// Obtener rutas registradas (para debugging)
const routes = router.getRoutes();
const middlewares = router.getMiddlewares();
```

### Combining Paths Utility

```typescript
import { Router } from '@voltrix/express';

// Utilidad para combinar paths
const fullPath = Router.combinePaths('/api', '/users');
// Resultado: '/api/users'
```

---

## 🎉 ¡Router Grouping Completo!

Voltrix ahora soporta **router grouping completo** con:
- ✅ **Express compatibility**: API familiar
- ✅ **Ultra performance**: Optimizaciones de Voltrix aplicadas
- ✅ **Nested routers**: Soporte completo para anidamiento
- ✅ **Middleware chaining**: Middleware específico por router
- ✅ **Path mounting**: Montaje flexible de rutas
- ✅ **Type safety**: TypeScript nativo

**¡Prueba la demo en `http://127.0.0.1:3001` para ver todo en acción!** 🚀