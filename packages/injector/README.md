# @voltrix/injector

Un contenedor de Inyección de Dependencias (DI) robusto, ultra-rápido y con soporte completo para `reflect-metadata`. 

## ¿Para qué sirve?

- Inyecta automáticamente servicios, repositorios y configuraciones en tus controladores.
- Gestiona el ciclo de vida de las dependencias (`SINGLETON`, `TRANSIENT`, `SCOPED`).
- Resuelve árboles de dependencias complejos sin overhead de ejecución gracias a su caché interna.
- Totalmente agnóstico del framework web, puede usarse de forma independiente.

## Instalación

```bash
npm install @voltrix/injector reflect-metadata
```

> **Nota:** Debes importar `reflect-metadata` una sola vez en el punto de entrada de tu aplicación.

## Ejemplo de Uso

```typescript
import 'reflect-metadata';
import { Injectable, DIContainer } from '@voltrix/injector';

@Injectable()
class DatabaseService {
  connect() { return "Connected to DB!"; }
}

@Injectable()
class UserService {
  constructor(private readonly db: DatabaseService) {}

  getUser() {
    return `User fetched. DB Status: ${this.db.connect()}`;
  }
}

// Resolver manualmente (normalmente `@voltrix/decorator` hace esto por ti)
const container = new DIContainer();
container.addProvider(DatabaseService);
container.addProvider(UserService);

const userService = container.resolve(UserService);
console.log(userService.getUser());
```
