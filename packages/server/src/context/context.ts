import type { HttpRequest, HttpResponse } from 'uWebSockets.js';
import { readBody } from './body-reader.js';
import { parseQueryString, normalizeBody, type BodyInput } from '../common/normalize.js';
import { STATUS_LINES, CONTENT_TYPES } from '../common/constants.js';

/**
 * Unified request/response context — one allocation per request.
 *
 * All request data is captured synchronously in `initialize()` while the uWS
 * HttpRequest object is still valid. After the synchronous handler frame, `req`
 * is invalid; only `res` persists.
 *
 * Naming convention:
 * - Request reading:  `header(name)`, `headers()`, `buffer()`, `text()`, `readJson<T>()`
 * - Response writing: `status()`, `setHeader()`, `json()`, `send()`, `end()`, `redirect()`
 *
 * Plugins extend Ctx via `server.decorateCtx(key, defaultValue)` which writes to
 * `Ctx.prototype` at startup — zero cost per request.
 *
 * `ctx.locals` is the built-in per-request metadata store. Use it to pass data
 * between hooks and handlers (e.g. authenticated user, tenant, parsed token).
 * It is reset to `{}` on every request — no state bleed across pool reuse.
 *
 * @example
 * ```ts
 * // In an onRequest hook:
 * server.addHook('onRequest', (ctx) => {
 *   ctx.locals.user = verifyToken(ctx.header('authorization'));
 * });
 *
 * // In the handler:
 * server.get('/me', (ctx) => {
 *   const { user } = ctx.locals as { user: User };
 *   ctx.json(user);
 * });
 * ```
 */
export class Ctx<P extends Record<string, string> = Record<string, string>> {
  // ─── Per-request metadata store ──────────────────────────────────────────

  /**
   * Built-in per-request metadata store.
   * Set values in `onRequest` / `preHandler` hooks; read them in the handler.
   * Reset to `{}` on every request — safe for object pool reuse.
   *
   * @example
   * ```ts
   * ctx.locals.user = { id: 42, role: 'admin' };
   * const user = ctx.locals.user as User;
   * ```
   */
  locals: Record<string, unknown> = {};

  // ─── Internal uWS handle ─────────────────────────────────────────────────

  private _res!: HttpResponse;

  // ─── Request data (captured synchronously in initialize) ─────────────────

  private _method!:   string;
  private _url!:      string;
  private _params!:   P;
  private _reqHeaders!: Record<string, string>;
  private _queryRaw!:  string;
  private _query:      Record<string, unknown> | null = null;

  // ─── Body state ───────────────────────────────────────────────────────────

  private _bodyBuffer: Buffer | null = null;
  private _bodyText:   string | null = null;
  private _bodyJson:   unknown = undefined;
  private _bodyLoaded = false;

  // ─── Response state ───────────────────────────────────────────────────────

  private _statusCode  = 200;
  private _sent        = false;
  private _aborted     = false;
  /** Flat array: [name0, value0, name1, value1, ...]. */
  private _resHeaders: string[] = [];

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  /**
   * Reset and bind to a new uWS request/response pair.
   * Called by CtxPool before handing the instance to a handler.
   *
   * uWS constraint: `req` is only valid synchronously. All req data must be
   * captured here, before any await boundary.
   */
  initialize(res: HttpResponse, req: HttpRequest, params: P, method: string, url: string): void {
    this._res         = res;
    this._method      = method;
    this._url         = url;
    this._params      = params;
    this._queryRaw    = req.getQuery() ?? '';
    this._query       = null;

    this._reqHeaders  = {};
    req.forEach((key, val) => {
      (this._reqHeaders as Record<string, string>)[key] = val;
    });

    this._statusCode  = 200;
    this._sent        = false;
    this._aborted     = false;
    this._resHeaders  = [];

    this._bodyBuffer  = null;
    this._bodyText    = null;
    this._bodyJson    = undefined;
    this._bodyLoaded  = false;

    this.locals = {};

    res.onAborted(() => { this._aborted = true; });
  }

  /**
   * Release all request-specific references.
   * Called by CtxPool after the response is sent.
   */
  release(): void {
    (this._res as unknown)        = null;
    (this._reqHeaders as unknown) = null;
    (this._params as unknown)     = null;
    this._bodyBuffer  = null;
    this._bodyText    = null;
    this._bodyJson    = undefined;
    this._resHeaders  = [];
    (this.locals as unknown) = null;
  }

  // ─── Request API ─────────────────────────────────────────────────────────

  /** HTTP method in UPPERCASE (GET, POST, …). */
  get method(): string { return this._method; }

  /** Request URL path (without query string). */
  get url(): string { return this._url; }

  /** Matched route parameters. */
  get params(): P { return this._params; }

  /** Parsed query string — lazily evaluated on first access. */
  get query(): Record<string, unknown> {
    if (this._query === null) {
      this._query = this._queryRaw ? parseQueryString(this._queryRaw) : {};
    }
    return this._query;
  }

  /**
   * Returns the value of a request header by lowercase name.
   * Returns `undefined` if the header is absent.
   */
  header(name: string): string | undefined {
    return this._reqHeaders[name.toLowerCase()];
  }

  /** Returns all request headers as a plain object (lowercase keys). */
  headers(): Record<string, string> { return this._reqHeaders; }

  // ─── Body API ─────────────────────────────────────────────────────────────

  /**
   * Read the full request body as a Buffer.
   * Lazy — reads on first call. Result is cached.
   */
  async buffer(): Promise<Buffer> {
    if (!this._bodyLoaded) {
      this._bodyBuffer = await readBody(this._res);
      this._bodyLoaded = true;
    }
    return this._bodyBuffer!;
  }

  /**
   * Read the full request body as a UTF-8 string.
   * Cached after first call.
   */
  async text(): Promise<string> {
    if (this._bodyText === null) {
      const buf = await this.buffer();
      this._bodyText = buf.toString('utf8');
    }
    return this._bodyText;
  }

  /**
   * Read and parse the request body as JSON.
   * Throws if the body is not valid JSON.
   * Cached after first call.
   *
   * Named `readJson` to avoid name collision with the response `json()` method.
   */
  async readJson<T = unknown>(): Promise<T> {
    if (this._bodyJson === undefined) {
      const t = await this.text();
      if (!t) return undefined as T;
      try {
        this._bodyJson = JSON.parse(t);
      } catch {
        throw new Error(`[voltrix/server] Invalid JSON body: ${t.slice(0, 100)}`);
      }
    }
    return this._bodyJson as T;
  }

  // ─── Response API ─────────────────────────────────────────────────────────

  /** True if the response has already been sent. */
  get sent(): boolean { return this._sent; }

  /** True if the connection was aborted by the client. */
  get aborted(): boolean { return this._aborted; }

  /**
   * Set the HTTP status code. Chainable.
   * Must be called before `json()`, `send()`, or `end()`.
   */
  status(code: number): this {
    this._statusCode = code;
    return this;
  }

  /**
   * Set a response header. Chainable.
   * Setting the same header name twice replaces the previous value.
   */
  setHeader(name: string, value: string): this {
    const lower = name.toLowerCase();
    for (let i = 0; i < this._resHeaders.length; i += 2) {
      if (this._resHeaders[i].toLowerCase() === lower) {
        this._resHeaders[i + 1] = value;
        return this;
      }
    }
    this._resHeaders.push(name, value);
    return this;
  }

  /**
   * Send a JSON response.
   * Sets Content-Type to application/json.
   * An optional `serialize` function replaces JSON.stringify.
   */
  json(data: unknown, serialize?: (v: unknown) => string): void {
    if (this._sent || this._aborted) return;
    const body = (serialize ?? JSON.stringify)(data) ?? 'null';
    this.setHeader('Content-Type', CONTENT_TYPES.JSON);
    this._flush(body);
  }

  /**
   * Send a body of any type.
   * Infers Content-Type from the body type if not already set.
   */
  send(body: BodyInput): void {
    if (this._sent || this._aborted) return;
    if (!this._hasResHeader('Content-Type')) {
      this.setHeader('Content-Type', typeof body === 'string' ? CONTENT_TYPES.TEXT : CONTENT_TYPES.BINARY);
    }
    this._flush(body);
  }

  /** Send with an empty body (e.g. 204 No Content). */
  end(): void {
    if (this._sent || this._aborted) return;
    this._flush('');
  }

  /**
   * Send a redirect response.
   * @param url  - The Location header value.
   * @param code - HTTP status code (default 302).
   */
  redirect(url: string, code = 302): void {
    if (this._sent || this._aborted) return;
    this._statusCode = code;
    this.setHeader('Location', url);
    this._flush('');
  }

  // ─── Internal flush ───────────────────────────────────────────────────────

  /**
   * Write status + headers + body to uWS.
   *
   * uWS NOTE: Do NOT call `res.end()` inside `cork()` — v20.60 adds
   * Content-Length twice (duplicate header bug). Write status/headers
   * directly, then call `res.end(payload)` outside cork.
   */
  _flush(body: BodyInput): void {
    if (this._sent || this._aborted) return;
    this._sent = true;

    const statusLine = STATUS_LINES[this._statusCode] ?? `${this._statusCode} Unknown`;
    const payload    = normalizeBody(body);

    this._res.writeStatus(statusLine);

    const h = this._resHeaders;
    for (let i = 0; i < h.length; i += 2) {
      this._res.writeHeader(h[i], h[i + 1]);
    }

    this._res.end(payload as string);
  }

  private _hasResHeader(name: string): boolean {
    const lower = name.toLowerCase();
    for (let i = 0; i < this._resHeaders.length; i += 2) {
      if (this._resHeaders[i].toLowerCase() === lower) return true;
    }
    return false;
  }
}
