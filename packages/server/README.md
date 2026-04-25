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
