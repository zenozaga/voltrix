# @voltrix/events

Un Event Bus tipado hiper-rápido para el ecosistema **Voltrix**, diseñado para comunicación síncrona y asíncrona entre módulos.

## ¿Para qué sirve?

- **Desacoplamiento:** Permite que distintas partes de tu aplicación se comuniquen sin importar referencias directas.
- **Soporte para Wildcards (`*`):** Suscríbete a patrones de eventos completos (ej. `user.*`).
- **Prioridades:** Define el orden exacto en el que los listeners deben ejecutarse.
- **Pluggable:** Listo para ser integrado con transportes externos (NATS, Redis) en el futuro.

## Instalación

```bash
npm install @voltrix/events
```

## Ejemplo de Uso

```typescript
import { EventBus } from '@voltrix/events';

const bus = new EventBus();

// Suscribirse a un evento específico con alta prioridad
bus.on('user.created', async (payload) => {
  console.log('Usuario creado:', payload.name);
}, { priority: 10 });

// Suscribirse a todos los eventos que empiecen por "user."
bus.on('user.*', (payload) => {
  console.log('Log de auditoría para usuario:', payload);
});

// Emitir el evento
await bus.emit('user.created', { name: 'Zeno' });
```
