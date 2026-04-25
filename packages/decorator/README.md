# @voltrix/decorator

Un sistema avanzado de decoradores experimentales para **Voltrix**, inspirado en la elegancia de frameworks como NestJS o Spring Boot, pero diseñado para tener overhead cero en tiempo de ejecución (O(1)).

## ¿Para qué sirve?

- Permite definir controladores web y rutas de forma declarativa y fuertemente tipada.
- Resuelve dependencias automáticamente usando `@voltrix/injector`.
- Soporta extracción de parámetros con validación automática (`@Body`, `@Param`, `@Query`, `@Header`).
- Auto-descubrimiento recursivo de Módulos (Bootstrapping completo de la App con una sola clase).
- Soporte para seguridad declarativa (`@Roles`, `@Scopes`, `@Public`).

## Instalación

```bash
npm install @voltrix/decorator reflect-metadata
```

## Ejemplo de Uso

```typescript
import 'reflect-metadata';
import { VoltrixApp, Controller, GET, POST, Body, Param, createVoltrix } from '@voltrix/decorator';

@Controller('users')
class UserController {
  @GET('/:id')
  async getUser(@Param('id') id: string) {
    return { id, name: 'Zeno' };
  }

  @POST('/')
  async createUser(@Body() data: any) {
    return { success: true, created: data };
  }
}

@VoltrixApp({
  port: 3000,
  controllers: [UserController]
})
class Application {}

// Bootstrapping mágico: Resuelve DI, escanea controladores y levanta el servidor
createApplication(Application);
```
