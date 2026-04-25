# @voltrix/core

Este paquete contiene los tipos fundamentales, interfaces y utilidades base compartidas en todo el ecosistema de **Voltrix**. Su objetivo principal es asegurar la integridad del tipado estricto (Type Safety) en todos los paquetes del monorepo sin introducir dependencias circulares.

## ¿Para qué sirve?

- Define las interfaces núcleo como `IRequest`, `IResponse`, `AppTree`, `ModuleNode`, etc.
- Exporta tipos de utilidad usados por el inyector de dependencias (DI) y los decoradores.
- Sirve como la fuente de la verdad para los contratos de tipado entre `@voltrix/server` y `@voltrix/express`.

## Instalación

Normalmente no necesitas instalar este paquete directamente a menos que estés creando un plugin o un paquete de terceros para el ecosistema Voltrix.

```bash
npm install @voltrix/core
```

## Ejemplo de Uso

Si estás desarrollando una herramienta que interactúa con el core de Voltrix:

```typescript
import { IRequest, IResponse, Constructor } from '@voltrix/core';

export function myCustomMiddleware(req: IRequest, res: IResponse, next: () => void) {
  console.log(`Petición entrante a: ${req.url}`);
  next();
}
```
