# @voltrix/swagger

Generador automático de documentación **OpenAPI 3.0** y visor embebido (Swagger UI) para **Voltrix**.

## ¿Para qué sirve?

- Genera de forma dinámica la especificación OpenAPI escaneando el RadixTree de `@voltrix/server` o procesando decoradores de `@voltrix/decorator`.
- Soporte nativo para inferencia de metadatos (rutas, esquemas, autorizaciones).
- Incluye el middleware `swaggerUi` listo para exponer la interfaz visual de la documentación sin configuraciones adicionales.

## Instalación

```bash
npm install @voltrix/swagger
```

## Ejemplo de Uso (Programático)

```typescript
import { createServer } from '@voltrix/server';
import { generateFromRouter, swaggerUi } from '@voltrix/swagger';

const server = createServer();

// Definimos una ruta con metadata para OpenAPI
server.get('/users', (ctx) => ctx.json([]))
  .meta('openapi', {
    summary: 'Obtener lista de usuarios',
    tags: ['Users']
  });

// Generar el documento JSON
const spec = generateFromRouter(server, { title: 'Mi API Voltrix', version: '1.0.0' });

// Exponer la UI de Swagger en /docs
server.any('/docs/*', swaggerUi(spec, '/docs'));

await server.listen({ port: 3000 });
```
