# @voltrix/server

El motor web núcleo de **Voltrix**. Una envoltura hiper-optimizada alrededor de `uWebSockets.js` diseñada para no hacer ninguna asignación de memoria (Zero-Allocation) en el "hot path" de peticiones.

## ¿Para qué sirve?

- **Rendimiento crudo:** Es el corazón que permite los ~90,000 req/s. 
- **Enrutamiento:** Implementa un `RadixTree` ultra-eficiente para resolución de rutas (O(k)).
- **Gestión de Memoria:** Utiliza un `CtxPool` (Object Pool pre-calentado) para reciclar objetos y evitar basura para el Garbage Collector.
- **Middlewares y Hooks:** Define el pipeline de ejecución (`onRequest`, `onResponse`, `onError`) de manera altamente optimizada.

## Instalación

Este es el paquete recomendado si quieres el rendimiento máximo absoluto sin las comodidades/overhead de Express.

```bash
npm install @voltrix/server
```

## Ejemplo de Uso

```typescript
import { createServer } from '@voltrix/server';

const server = createServer({ poolSize: 5000 });

server.get('/ping', (ctx) => {
  // El contexto está tipado y protegido de allocations innecesarias
  ctx.status(200).json({ pong: true });
});

server.post('/echo', async (ctx) => {
  const body = await ctx.readJson();
  ctx.json(body);
});

await server.listen({ port: 3000 });
console.log('Listening on http://localhost:3000');
```

## Características Avanzadas

### 1. Metadata (`.meta`)
Puedes añadir datos personalizados a cualquier ruta (muy útil para generar OpenAPI, controlar permisos o documentar).

```typescript
server.get('/users/:id', (ctx) => {
  ctx.json({ id: ctx.params.id });
}).meta('openapi', {
  summary: 'Obtener usuario por ID',
  tags: ['Users']
});

// Más tarde, puedes extraer todas las rutas con metadata 'openapi':
const docs = server.routes().byMeta('openapi');
```

### 2. Plugins y Middlewares (`onRequest`)
Voltrix usa un sistema de hooks súper ligero en lugar del clásico stack asíncrono de middlewares para mantener las allocations a cero. Puedes agrupar lógica usando `server.plugin()`.

```typescript
// Un plugin para autenticación
server.plugin(async (instance) => {
  // Pre-alocar espacio en el contexto prototipo (O(1), zero-allocation)
  instance.decorateCtx('user', null);

  // Hook global que se ejecuta antes del handler
  instance.onRequest((ctx) => {
    const auth = ctx.header('authorization');
    if (!auth) {
      ctx.status(401).json({ error: 'Missing token' });
      return; // Corta la ejecución si no hay token
    }
    // ctx.user ya está definido en el prototipo, reasignarlo es ultra rápido
    ctx.user = { id: 1, role: 'admin' }; 
  });
});
```

### 3. Validación de Payload (Validator)
Puedes leer y validar el body de forma síncrona o asíncrona usando librerías como Zod integradas directamente en tu handler o a través de un wrapper.

```typescript
import { z } from 'zod';

const UserSchema = z.object({
  name: z.string().min(3),
  age: z.number().int()
});

server.post('/users', async (ctx) => {
  try {
    const rawBody = await ctx.readJson();
    
    // Validación de Zod
    const validData = UserSchema.parse(rawBody);
    
    ctx.status(201).json({ success: true, data: validData });
  } catch (error) {
    if (error instanceof z.ZodError) {
      ctx.status(400).json({ error: 'Validation failed', issues: error.issues });
    } else {
      ctx.status(500).json({ error: 'Internal error' });
    }
  }
});
```

### 4. Serialización de Alto Rendimiento (Fast JSON / Zero-Copy)
Voltrix permite delegar la serialización JSON a librerías como `fast-json-stringify`, que pueden ser significativamente más rápidas que `JSON.stringify` nativo al usar esquemas pre-compilados y evitar allocations innecesarias en el hot-path.

#### Uso por Ruta (Ad-hoc)
Puedes pasar un serializador específico directamente al método `ctx.json()`. Esto es ideal para optimizar rutas críticas de forma aislada.

```typescript
import fastJson from 'fast-json-stringify';

const serializeUser = fastJson({
  type: 'object',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' }
  }
});

server.get('/users/:id', (ctx) => {
  const user = { id: ctx.params.id, name: 'John Doe' };
  // Pasamos el serializador como segundo argumento
  ctx.json(user, serializeUser);
});
```

#### Uso Global (Compiler Pattern)
Para una arquitectura más limpia, puedes definir un **Serializer Compiler**. Voltrix compilará los esquemas automáticamente al arranque (startup), eliminando el costo de búsqueda de esquemas durante las peticiones.

```typescript
const myCompiler = {
  compile: (schema) => fastJson(schema)
};

// Configuramos el compilador global
server.setSerializerCompiler(myCompiler);

// Ahora podemos usar .serialize() en el builder de rutas
server.get('/users/:id', (ctx) => {
  return { id: ctx.params.id };
}).serialize({
  type: 'object',
  properties: {
    id: { type: 'string' }
  }
});
```

Este patrón asegura que en el "hot path", Voltrix use directamente la función pre-compilada, acercándose al límite físico de transferencia de datos (Zero-Copy).

