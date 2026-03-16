---
trigger: always_on
---

# Voltrix MCP Guidelines

## Core
- Usar **Builder Pattern** siempre. Nada de config directa sin validación.
- Arquitectura por **plugins**: SRP, composable, extensible, typed, traceable.
- Diseño **performance-first**: hot paths sin alloc innecesaria, lazy load, pooling, streaming, cache <1ms.

## Reglas obligatorias
- Validar plugins: config, compatibilidad, conflictos.
- Toda transformación debe dejar trazabilidad:
  - `value`
  - `original`
  - `transformations[]` con `pluginId`, `pluginName`, `operation`, `timestamp`, `metadata?`, `performance?`
- Evitar `async/await` en hot paths si existe alternativa sync.
- Preferir `Buffer` sobre concatenación de strings para binario.
- Cachear cálculos/accesos frecuentes.
- Usar `Object.freeze()` en configs inmutables.
- Medir CPU y memoria en componentes core.
- Inicialización lazy para operaciones costosas.

## Naming
- archivos: `kebab-case`
- clases/interfaces/types: `PascalCase`
- variables/funciones: `camelCase`
- agrupar por feature, no por tipo

## Monorepo
- Cada package = una responsabilidad clara.
- Usar `workspace:*`
- `pnpm`
- `tsup` para build
- `vitest` + coverage
- soportar Node y browser cuando aplique

## uWebSockets.js
- Nunca bloquear event loop
- Usar APIs nativas de uWS
- Compatibilidad estilo Express sin sacrificar performance
- HTTP + WS en el mismo puerto si aplica
- Manejar backpressure correctamente
- usar compresión nativa de uWS si existe

## Router
- Usar **radix tree**
- Cachear rutas compiladas
- Soportar params estilo Express (`:id`, `*`)
- Optimizar chain de middlewares
- Evitar regex en hot path
- Precompilar handlers al startup

## Middleware
- Firma compatible: `(req, res, next) => void`
- soportar async con propagación correcta de errores
- permitir short-circuit
- error boundaries
- middleware condicional por path/method

## Memoria
- Pooling de request/response y buffers
- limpiar referencias rápido
- `WeakMap` para datos request-scoped
- controlar crecimiento de memoria

## Intercomunicación entre servers
- contexto compartido solo si se necesita
- message passing correcto
- errores bien manejados
- aislamiento por defecto

## Docs
- JSDoc en APIs públicas
- documentar params, returns y lógica compleja
- README al día
- OpenAPI/Swagger para APIs públicas
- incluir ejemplos y errores

## Testing
### Regla crítica
- **NO mocks HTTP**
- usar **HTTP real** siempre
- usar `createApplication()`
- usar `fetch()`
- puertos reales
- pruebas de integración reales

### Requisitos
- todas las features con tests
- performance tests <100ms
- coverage con `@vitest/coverage-v8`
- nombres de tests claros y orientados a negocio
- probar controladores directo en unit tests
- probar pipeline real de middleware, decorators, errores y multi-server orchestration

## Errores y logs
- usar errores custom por dominio
- incluir contexto
- degradación elegante cuando aplique
- logs estructurados
- correlation IDs
- no loggear datos sensibles

## Performance 2024-2025
- Radix Trees
- Bloom Filters
- LRU con `Map`
- Boyer-Moore para búsquedas
- hash-based routing
- object pooling
- bitwise ops para flags
- optimizar branch prediction
- loop unrolling en loops críticos
- evitar llamadas extra en hot paths
- inline estratégico
- optimizar para V8 moderno

## Decorators
- Tipos centralizados en una sola ubicación
- Decorators creados con factory pattern
- cero duplicación
- metas:
  - decorator simple <1ms
  - metadata compleja <10ms
  - route registration <5ms por ruta
  - <1MB overhead para 1000+ métodos decorados

## IA / Agent rules
### Siempre seguir este flujo
1. Analizar patrones existentes
2. Reusar tipos/componentes
3. Diseñar tipos centralizados
4. Diseñar factories
5. Crear test primero
6. Implementar core
7. Medir performance
8. Validar memoria
9. Verificar cero duplicación
10. Documentar

### Checklist obligatorio
- tipos centralizados
- cero duplicación
- tests reales HTTP
- benchmarks incluidos
- factory patterns
- optimización de memoria
- algoritmos modernos

### Nunca
- `vi.fn()` para HTTP
- duplicar types
- decorators sin factory
- features sin benchmarks
- algoritmos viejos
- ignorar memoria

### Siempre
- `createApplication()`
- importar types centralizados
- benchmarks
- estructuras y algoritmos modernos
- profiling de memoria y CPU

## Success metrics
Cada feature debe cumplir:
- tests reales HTTP
- performance dentro del budget
- cero duplicación
- tipos centralizados
- algoritmos modernos
- optimización de memoria