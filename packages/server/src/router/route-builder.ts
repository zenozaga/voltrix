import type { ValidatorCompiler, RouteValidators, RouteSchemas } from '../validators/types.js';
import type { OnRequestHook, PreHandlerHook, OnSendHook, OnResponseHook, OnErrorHook } from '../hooks/hook-types.js';
import type { RouteHandler, RouteMeta, RouteDefinition } from './route-definition.js';
import type { SerializerCompiler, RouteSerializer } from '../serializers/types.js';
import type { HttpMethod } from '../common/constants.js';
import { emptyHookSet } from '../hooks/hook-types.js';
import type { HookSet } from '../hooks/hook-types.js';

/**
 * Fluent builder for a single route definition.
 * Created by the Router for each `get()`, `post()`, etc. call.
 * Call `build()` to produce the immutable RouteDefinition.
 */
export class RouteBuilder {
  private readonly _hooks: HookSet = emptyHookSet();
  private readonly _meta: RouteMeta = new Map();
  private _serializer: RouteSerializer | null = null;
  private _validators: RouteValidators | null = null;
  private _schemas: RouteSchemas | null = null;

  constructor(
    readonly method:   HttpMethod,
    readonly pattern:  string,
    readonly handler:  RouteHandler,
  ) {}

  // ─── Metadata ─────────────────────────────────────────────────────────────

  /**
   * Attach namespaced metadata to this route.
   * Multiple calls with different namespaces accumulate — they do not overwrite.
   *
   * @example
   * ```ts
   * router.get('/users', handler)
   *   .meta('swagger', { summary: 'List users', tags: ['Users'] })
   *   .meta('auth',    { roles: ['admin'] });
   * ```
   */
  meta(namespace: string, data: unknown): this {
    this._meta.set(namespace, data);
    return this;
  }

  // ─── Serialization ────────────────────────────────────────────────────────

  /**
   * Attach a response schema to this route.
   * The schema is compiled by the server's SerializerCompiler at startup.
   *
   * @example
   * ```ts
   * // Using fast-json-stringify schema
   * router.get('/users', handler).serialize({
   *   type: 'object',
   *   properties: { id: { type: 'integer' }, name: { type: 'string' } }
   * });
   * ```
   */
  serialize(schema: unknown, compiler?: SerializerCompiler): this {
    if (compiler) {
      this._serializer = { schema, serialize: compiler.compile(schema) };
    } else {
      // Schema stored; compiled by server's global compiler at route registration
      this._serializer = { schema, serialize: JSON.stringify };
    }
    return this;
  }

  // ─── Validation ───────────────────────────────────────────────────────────

  /**
   * Attach request validation schemas to this route.
   * Schemas are compiled by the server's ValidatorCompiler at startup.
   *
   * @example
   * ```ts
   * router.post('/users', handler).validate({
   *   body: userCreateSchema,
   *   params: { type: 'object', properties: { id: { type: 'string' } } }
   * });
   * ```
   */
  validate(schemas: RouteSchemas, compiler?: ValidatorCompiler): this {
    this._schemas = schemas;
    if (compiler) {
      this._validators = compileSchemas(schemas, compiler);
    }
    // Without a compiler, validation is applied later by the server's global compiler
    return this;
  }

  // ─── Route-local hooks ────────────────────────────────────────────────────

  onRequest(hook: OnRequestHook): this {
    this._hooks.onRequest.push(hook);
    return this;
  }

  preHandler(hook: PreHandlerHook): this {
    this._hooks.preHandler.push(hook);
    return this;
  }

  onSend(hook: OnSendHook): this {
    this._hooks.onSend.push(hook);
    return this;
  }

  onResponse(hook: OnResponseHook): this {
    this._hooks.onResponse.push(hook);
    return this;
  }

  onError(hook: OnErrorHook): this {
    this._hooks.onError.push(hook);
    return this;
  }

  // ─── Build ────────────────────────────────────────────────────────────────

  /**
   * Produce the immutable RouteDefinition.
   * Called internally by the router — not intended for direct use.
   */
  build(globalSerializer?: SerializerCompiler, globalValidator?: ValidatorCompiler): RouteDefinition {
    // Apply global compilers if route-local ones weren't provided
    let serializer = this._serializer;
    if (serializer && serializer.serialize === JSON.stringify && globalSerializer) {
      serializer = { schema: serializer.schema, serialize: globalSerializer.compile(serializer.schema) };
    }

    let validators = this._validators;
    if (!validators && this._schemas && globalValidator) {
      validators = compileSchemas(this._schemas, globalValidator);
    }

    return {
      method:     this.method,
      pattern:    this.pattern,
      handler:    this.handler,
      hooks:      this._hooks,
      serializer,
      validators,
      meta:       this._meta,
      paramNames: extractParamNames(this.pattern),
    };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function compileSchemas(schemas: RouteSchemas, compiler: ValidatorCompiler): RouteValidators {
  return {
    body:    schemas.body    ? compiler.compile(schemas.body)    : undefined,
    query:   schemas.query   ? compiler.compile(schemas.query)   : undefined,
    params:  schemas.params  ? compiler.compile(schemas.params)  : undefined,
    headers: schemas.headers ? compiler.compile(schemas.headers) : undefined,
  };
}

/**
 * Extract named parameter segments from a pattern.
 * `/users/:id/posts/:postId` → ['id', 'postId']
 */
function extractParamNames(pattern: string): string[] {
  const names: string[] = [];
  const segments = pattern.split('/');
  for (const seg of segments) {
    if (seg.startsWith(':')) names.push(seg.slice(1));
  }
  return names;
}
