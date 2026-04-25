# @voltrix/express

El adaptador/bridge de **Express.js** hiper-optimizado para **Voltrix**. Permite migrar aplicaciones existentes de Express a Voltrix sin tener que reescribir todo el código, multiplicando el rendimiento por ~4x-10x en comparación con Node+Express puro.

## ¿Para qué sirve?

- **Compatibilidad Express:** Provee las APIs familiares (`req.json()`, `res.status().json()`, `res.send()`, `app.use()`).
- **Migración sin fricción:** Usa la misma firma de middlewares `(req, res, next)`.
- **Rendimiento Nativo:** Delega todo el enrutamiento al Kernel `PipelineRunner` y al `RadixTree` de `@voltrix/server`. Las pruebas demuestran que usar este adaptador tiene solo un 1-2% de overhead frente al Kernel puro.

## Instalación

```bash
npm install @voltrix/express
```

## Ejemplo de Uso

```typescript
import voltrix from '@voltrix/express';

const app = voltrix();

// Middleware estilo Express
app.use((req, res, next) => {
  console.log(`[LOG] ${req.method} ${req.url}`);
  next();
});

// Rutas familiares
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
