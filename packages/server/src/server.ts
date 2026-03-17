import uWS from 'uWebSockets.js';
import { CtxPool } from './context/pool.js';
import { Ctx } from './context/context.js';
import { RadixTree } from './router/radix-tree.js';
import { RouteRegistry } from './router/route-registry.js';
import { Router, createRouter } from './router/router.js';
import { RouteBuilder } from './router/route-builder.js';
import { PluginManager } from './plugins/plugin-manager.js';
import { emptyHookSet } from './hooks/hook-types.js';
import { compilePipeline } from './hooks/pipeline-runner.js';
import { mergeHooks } from './hooks/hook-manager.js';
import { defaultSerializerCompiler } from './serializers/default.js';
import { isHttpError } from './errors/http-error.js';
import { CONTENT_TYPES } from './common/constants.js';
import type { RouteHandler, CompiledRoute } from './router/route-definition.js';
import type { HookSet } from './hooks/hook-types.js';
import type { SerializerCompiler } from './serializers/types.js';
import type { ValidatorCompiler } from './validators/types.js';
import type { VoltrixPlugin } from './plugins/plugin-types.js';
import type { HttpMethod } from './common/constants.js';
import type { RouteTreeEntry } from './router/route-registry.js';

export interface VoltrixServerOptions {
  /** Initial Ctx pool size. Default: 64. */
  poolSize?: number;
  /** Enable SSL/TLS. Provide cert and key paths. */
  ssl?: {
    cert: string;
    key:  string;
    ca?:  string;
  };
}

export interface ListenOptions {
  host?: string;
  port: number;
}

/**
 * VoltrixServer — ultra-fast HTTP server core.
 *
 * Features:
 * - Unified Ctx (one allocation per request)
 * - Pre-classified hook pipelines (sync: 19M ops/s, mixed: 17M ops/s)
 * - Radix tree routing (O(k) match, zero regex in hot path)
 * - Object pool for Ctx reuse (zero GC pressure at steady state)
 * - Plugin system with prototype-level Ctx decoration
 * - Pluggable serializer and validator compilers
 *
 * @example
 * ```ts
 * const server = createServer();
 *
 * server.get('/ping', (ctx) => ctx.json({ pong: true }));
 * server.get('/users/:id', (ctx) => ctx.json({ id: ctx.params.id }));
 *
 * await server.listen({ port: 3000 });
 * ```
 */
export class VoltrixServer {
  private readonly _app: uWS.TemplatedApp;
  private readonly _pool: CtxPool;
  private readonly _tree: RadixTree;
  private readonly _registry: RouteRegistry;
  private readonly _globalHooks: HookSet;
  private readonly _builders: RouteBuilder[] = [];
  private readonly _pluginManager: PluginManager;
  private readonly _serializerRef: { value: SerializerCompiler };
  private readonly _validatorRef:  { value: ValidatorCompiler | undefined };

  private _listenSocket: uWS.us_listen_socket | null = null;

  constructor(opts: VoltrixServerOptions = {}) {
    this._app      = opts.ssl
      ? uWS.SSLApp({ cert_file_name: opts.ssl.cert, key_file_name: opts.ssl.key, ca_file_name: opts.ssl.ca })
      : uWS.App();

    this._pool     = new CtxPool(opts.poolSize ?? 64);
    this._tree     = new RadixTree();
    this._registry = new RouteRegistry();
    this._globalHooks   = emptyHookSet();
    this._serializerRef = { value: defaultSerializerCompiler };
    this._validatorRef  = { value: undefined };

    this._pluginManager = new PluginManager(
      this._globalHooks,
      this._serializerRef,
      this._validatorRef,
      this._pool,
    );
  }

  // ─── Plugin API ───────────────────────────────────────────────────────────

  /**
   * Register a plugin. Plugins run at startup — before `listen()`.
   * Await this if the plugin's `register()` is async.
   */
  async register<TOptions>(plugin: VoltrixPlugin<TOptions>, opts: TOptions): Promise<this>;
  async register<TOptions>(plugin: VoltrixPlugin<TOptions>): Promise<this>;
  async register<TOptions>(plugin: VoltrixPlugin<TOptions>, opts?: TOptions): Promise<this> {
    await this._pluginManager.register(plugin, opts as TOptions);
    return this;
  }

  // ─── Global hooks ─────────────────────────────────────────────────────────

  addHook<K extends keyof HookSet>(name: K, hook: HookSet[K][number]): this {
    (this._globalHooks[name] as unknown[]).push(hook);
    return this;
  }

  // ─── Compiler overrides ───────────────────────────────────────────────────

  setSerializerCompiler(compiler: SerializerCompiler): this {
    this._serializerRef.value = compiler;
    return this;
  }

  setValidatorCompiler(compiler: ValidatorCompiler): this {
    this._validatorRef.value = compiler;
    return this;
  }

  // ─── Route registration ───────────────────────────────────────────────────

  get(pattern: string, handler: RouteHandler): RouteBuilder {
    return this._addRoute('GET', pattern, handler);
  }

  post(pattern: string, handler: RouteHandler): RouteBuilder {
    return this._addRoute('POST', pattern, handler);
  }

  put(pattern: string, handler: RouteHandler): RouteBuilder {
    return this._addRoute('PUT', pattern, handler);
  }

  patch(pattern: string, handler: RouteHandler): RouteBuilder {
    return this._addRoute('PATCH', pattern, handler);
  }

  delete(pattern: string, handler: RouteHandler): RouteBuilder {
    return this._addRoute('DELETE', pattern, handler);
  }

  head(pattern: string, handler: RouteHandler): RouteBuilder {
    return this._addRoute('HEAD', pattern, handler);
  }

  options(pattern: string, handler: RouteHandler): RouteBuilder {
    return this._addRoute('OPTIONS', pattern, handler);
  }

  /**
   * Mount a sub-router. All routes in the router are registered with their
   * prefixed patterns at the server level.
   */
  use(router: Router): this {
    for (const builder of router.builders()) {
      this._builders.push(builder);
    }
    return this;
  }

  // ─── Introspection ────────────────────────────────────────────────────────

  /**
   * Returns the route registry — full definitions with metadata.
   * Use for OpenAPI generation, decorator introspection, etc.
   */
  routes(): RouteRegistry { return this._registry; }

  /**
   * Returns a JSON-safe snapshot of the route tree.
   * No functions — safe to log, serialize, or pass to external tools.
   */
  tree(): RouteTreeEntry[] { return this._registry.toTree(); }

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  /**
   * Compile all registered routes and start listening.
   * Must be called after all routes and plugins are registered.
   */
  async listen(opts: ListenOptions): Promise<void> {
    this._compileRoutes();

    return new Promise((resolve, reject) => {
      const cb = (socket: uWS.us_listen_socket | false) => {
        if (!socket) {
          reject(new Error(`[voltrix/server] Failed to listen on port ${opts.port}`));
          return;
        }
        this._listenSocket = socket;
        resolve();
      };

      if (opts.host) {
        this._app.listen(opts.host, opts.port, cb);
      } else {
        this._app.listen(opts.port, cb);
      }
    });
  }

  /** Close the server gracefully. */
  close(): void {
    if (this._listenSocket) {
      uWS.us_listen_socket_close(this._listenSocket);
      this._listenSocket = null;
    }
  }

  // ─── Internal ─────────────────────────────────────────────────────────────

  private _addRoute(method: HttpMethod, pattern: string, handler: RouteHandler): RouteBuilder {
    const builder = new RouteBuilder(method, pattern, handler);
    this._builders.push(builder);
    return builder;
  }

  /**
   * Compile all route builders into the radix tree and registry.
   * Called once at `listen()` time — never on hot path.
   */
  private _compileRoutes(): void {
    // Catch-all for any unregistered route — must be registered BEFORE route handlers
    // so that uWS evaluates specific patterns first (uWS matches in registration order).
    // We register it last so specific routes take priority.
    for (const builder of this._builders) {
      const def = builder.build(this._serializerRef.value, this._validatorRef.value);
      this._registry.add(def);

      // Merge global hooks with route-local hooks
      const onRequest  = mergeHooks(this._globalHooks.onRequest,  def.hooks.onRequest);
      const preHandler = mergeHooks(this._globalHooks.preHandler, def.hooks.preHandler);
      const onResponse = mergeHooks(this._globalHooks.onResponse, def.hooks.onResponse);

      // Pre-classify and compile each pipeline
      const compiled: CompiledRoute = {
        handler:    def.handler,
        onRequest:  compilePipeline(onRequest),
        preHandler: compilePipeline(preHandler),
        onResponse: compilePipeline(onResponse),
        serializer: def.serializer,
        validators: def.validators,
        paramNames: def.paramNames,
      };

      this._tree.insert(def.method, def.pattern, compiled);

      // Register uWS handler for this method+pattern
      this._registerUwsRoute(def.method, def.pattern);
    }

    // Catch-all 404 — registered last so specific patterns take priority
    this._app.any('/*', (res) => {
      res.writeStatus('404 Not Found');
      res.writeHeader('Content-Type', CONTENT_TYPES.JSON);
      res.end('{"statusCode":404,"code":"NOT_FOUND","message":"Not Found"}');
    });
  }

  /**
   * Register a uWS route handler for the given method and pattern.
   * uWS uses its own pattern syntax (`:name` params, `*` wildcard).
   */
  private _registerUwsRoute(method: HttpMethod, pattern: string): void {
    const uwsPattern = toUwsPattern(pattern);
    const dispatch = this._dispatch.bind(this, method);

    switch (method) {
      case 'GET':     this._app.get(uwsPattern, dispatch);     break;
      case 'POST':    this._app.post(uwsPattern, dispatch);    break;
      case 'PUT':     this._app.put(uwsPattern, dispatch);     break;
      case 'PATCH':   this._app.patch(uwsPattern, dispatch);   break;
      case 'DELETE':  this._app.del(uwsPattern, dispatch);     break;
      case 'HEAD':    this._app.head(uwsPattern, dispatch);    break;
      case 'OPTIONS': this._app.options(uwsPattern, dispatch); break;
    }
  }

  /**
   * Hot path — called by uWS for every matched request.
   * Acquire Ctx → run onRequest pipeline → run preHandler → run handler → release Ctx.
   */
  private async _dispatch(
    method: HttpMethod,
    res:    uWS.HttpResponse,
    req:    uWS.HttpRequest,
  ): Promise<void> {
    const url   = req.getUrl();
    const match = this._tree.match(method, url);

    // Not found — uWS already matched the pattern, this should never happen
    // unless multiple patterns overlap. Defensive fallback.
    if (!match) {
      res.writeStatus('404 Not Found');
      res.writeHeader('Content-Type', CONTENT_TYPES.JSON);
      res.end('{"statusCode":404,"message":"Not Found"}');
      return;
    }

    // Build params map from names + extracted values
    const params = buildParams(match.route.paramNames, match.paramValues);

    // Acquire a pooled Ctx — this captures all req data synchronously
    const ctx = this._pool.acquire(res, req, params);

    try {
      // Validate request if validators are configured
      if (match.route.validators) {
        runValidators(ctx, match.route.validators);
      }

      // onRequest pipeline
      await match.route.onRequest(ctx);
      if (ctx.sent || ctx.aborted) return;

      // preHandler pipeline
      await match.route.preHandler(ctx);
      if (ctx.sent || ctx.aborted) return;

      // Route handler
      const result = await match.route.handler(ctx);

      // If handler returned a value without sending, auto-serialize it
      if (!ctx.sent && !ctx.aborted && result !== undefined) {
        const serialize = match.route.serializer?.serialize;
        ctx.json(result, serialize);
      }

      // Safeguard: if handler returned undefined without sending, close cleanly
      if (!ctx.sent && !ctx.aborted) {
        ctx.status(204).end();
      }

      // onResponse pipeline
      if (!ctx.aborted) {
        await match.route.onResponse(ctx);
      }
    } catch (err) {
      if (!ctx.sent && !ctx.aborted) {
        await this._sendError(ctx, err);
      }
    } finally {
      this._pool.release(ctx);
    }
  }

  /**
   * Default error responder.
   * Runs all global onError hooks in order. Falls back to default JSON error if
   * no hook sends a response.
   */
  private async _sendError(ctx: Ctx, err: unknown): Promise<void> {
    const hooks = this._globalHooks.onError;
    for (const hook of hooks) {
      try {
        await hook(ctx, err);
      } catch { /* swallow secondary errors in error hooks */ }
      if (ctx.sent) return;
    }

    // Default error response
    if (isHttpError(err)) {
      ctx.status(err.statusCode).json(err.toJSON());
      return;
    }

    const message = err instanceof Error ? err.message : 'Internal Server Error';
    ctx.status(500).json({ statusCode: 500, message });
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Create a new VoltrixServer instance.
 * @param opts - Optional server options.
 */
export function createServer(opts?: VoltrixServerOptions): VoltrixServer {
  return new VoltrixServer(opts);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Convert our `:name` pattern to the uWS pattern format.
 * uWS uses the same `:name` syntax, so no translation needed.
 * Wildcard `*` is also compatible.
 */
function toUwsPattern(pattern: string): string {
  return pattern;
}

/**
 * Build a params Record from parallel arrays of names and values.
 * @param names  - Parameter names in declaration order.
 * @param values - Extracted values from the radix tree match.
 */
function buildParams(names: string[], values: string[]): Record<string, string> {
  if (names.length === 0) return {};
  const params: Record<string, string> = {};
  for (let i = 0; i < names.length; i++) {
    params[names[i]] = values[i] ?? '';
  }
  return params;
}

/**
 * Run request validators (body, query, params, headers).
 * Throws if validation fails.
 */
function runValidators(ctx: Ctx, validators: NonNullable<CompiledRoute['validators']>): void {
  if (validators.params  && !validators.params(ctx.params)) {
    throw Object.assign(new Error('Invalid path parameters'), { statusCode: 400 });
  }
  if (validators.headers && !validators.headers(ctx.headers())) {
    throw Object.assign(new Error('Invalid request headers'), { statusCode: 400 });
  }
  // Note: body and query are lazy — validated when first accessed
}
