import type { HttpRequest, HttpResponse } from 'uWebSockets.js';
import { IRequest } from '../types/http.js';
import { parseMultipart, MultipartPart } from '../common/multipart.js';

export type QueryParser = (queryString: string) => Record<string, any>;
export type ParamsParser = (pattern: string, url: string) => Record<string, string>;

export class Request implements IRequest {
  private cachedBuffer?: Buffer;
  private cachedBody?: string;
  private cachedJSON?: any;

  private detectedJSON: boolean | null = null;
  private checkedJSON = false;

  private routePattern?: string;
  private cachedQuery?: Record<string, any>;
  private cachedParams?: Record<string, string>;
  private paramIndices?: Map<string, number>;
  private _method?: string;
  private _url?: string;

  private dataListeners: ((chunk: Uint8Array, isLast: boolean) => void)[] = [];
  private dataConsuming = false;

  constructor() {
    this.context = {};
  }

  /**
   * Reset instance for reuse in ObjectPool
   */
  initialize(
    request: HttpRequest, 
    response: HttpResponse, 
    pattern?: string, 
    paramIndices?: Map<string, number>,
    method?: string,
    url?: string
  ): void {
    this.request = request;
    this.response = response;
    this.routePattern = pattern;
    this.paramIndices = paramIndices;
    
    this._method = method || request.getMethod().toUpperCase();
    this._url = url || request.getUrl();
    
    // Capture headers synchronously
    this._headers = {};
    request.forEach((k, v) => (this._headers![k] = v));

    const qs = request.getQuery();
    this.cachedQuery = qs ? Request.queryParser(qs) : {};

    this.cachedBuffer = undefined;
    this.cachedBody = undefined;
    this.cachedJSON = undefined;
    this.detectedJSON = null;
    this.checkedJSON = false;

    // Capture parameters synchronously while request is valid
    if (this.paramIndices) {
      this.cachedParams = {};
      for (const [name, index] of this.paramIndices.entries()) {
        this.cachedParams[name] = request.getParameter(index) || '';
      }
    } else if (this.routePattern) {
      this.cachedParams = Request.paramsParser(this.routePattern, this._url);
    }
    this.context = {};
    this.dataListeners = [];
    this.dataConsuming = false;
    this.accumulatedChunks = [];
    this.streamFinished = false;

    // uWS Gotcha: Start consuming data immediately if there's a body
    const cl = this._headers['content-length'];
    if (cl && cl !== '0') {
      this.ensureDataStarted();
    }
  }

  private ensureDataStarted(): void {
    if (this.dataConsuming) return;
    this.dataConsuming = true;

    this.response.onData((ab, isLast) => {
      const chunk = new Uint8Array(ab);
      const copy = new Uint8Array(chunk.length);
      copy.set(chunk);

      this.accumulatedChunks.push(copy);

      for (const listener of this.dataListeners) {
        listener(copy, isLast);
      }

      if (isLast) {
        this.streamFinished = true;
        this.dataListeners = [];
      }
    });
  }

  public context!: Record<string, any>;
  private request!: HttpRequest;
  private response!: HttpResponse;
  private accumulatedChunks: Uint8Array[] = [];
  private streamFinished = false;
  private _headers: Record<string, string> = {};

  // ================================================================
  // BUFFER → BODY → JSON  (High-performance implementation)
  // ================================================================

  async buffer(): Promise<Buffer> {
    if (this.cachedBuffer) return this.cachedBuffer;

    return (this.cachedBuffer = await new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];

      this.onData((chunk, isLast) => {
        // ------------------------------------------------------------
        // EARLY JSON DETECTION
        // ------------------------------------------------------------
        if (!this.checkedJSON) {
          for (let i = 0; i < chunk.length; i++) {
            const byte = chunk[i];
            if (byte === 32 || byte === 9 || byte === 10 || byte === 13) continue;
            this.detectedJSON = byte === 0x7b || byte === 0x5b;
            this.checkedJSON = true;
            break;
          }
        }

        chunks.push(Buffer.from(chunk));
        if (isLast) resolve(Buffer.concat(chunks));
      });

      this.response.onAborted(() => reject(new Error('Request aborted')));
    }));
  }

  async body(): Promise<string> {
    if (this.cachedBody) return this.cachedBody;
    const buf = await this.buffer();
    return (this.cachedBody = buf.toString('utf8'));
  }

  async json<T = any>(): Promise<T> {
    if (this.cachedJSON) return this.cachedJSON;

    const buf = await this.buffer();
    if (buf.length === 0) return undefined as unknown as T;

    try {
      this.cachedJSON = JSON.parse(buf.toString('utf8'));
      return this.cachedJSON as T;
    } catch (e) {
      throw new Error('Invalid JSON: failed to parse body');
    }
  }

  // ================================================================
  // REQUEST API (query, params, headers)
  // ================================================================

  pattern(value?: string): string | undefined {
    if (value !== undefined) {
      this.routePattern = value;
      this.cachedParams = undefined;
    }
    return this.routePattern;
  }

  get method(): string {
    return this._method!;
  }

  get url(): string {
    return this._url!;
  }

  get query(): Record<string, any> {
    return this.cachedQuery || {};
  }

  get params(): Record<string, string> {
    return this.cachedParams ||= {};
  }

  getQuery(name: string): any {
    return this.query[name];
  }

  getParam(name: string): string | undefined {
    return this.params[name];
  }

  header(name: string): string {
    return this._headers[name.toLowerCase()] || this._headers[name];
  }

  headers(): Record<string, string> {
    return this._headers;
  }

  onData(handler: (chunk: Uint8Array, isLast: boolean) => void): void {
    if (this.streamFinished) {
      const full = Buffer.concat(this.accumulatedChunks);
      handler(full, true);
      return;
    }

    this.dataListeners.push(handler);
    this.ensureDataStarted();
  }

  async parseMultipart(onPart: (part: MultipartPart) => void | Promise<void>): Promise<void> {
    return parseMultipart(this, onPart);
  }

  // ================================================================
  // STATIC PARSERS
  // ================================================================

  static setQueryParser(fn: QueryParser): void {
    Request.queryParser = fn;
  }

  static setParamsParser(fn: ParamsParser): void {
    Request.paramsParser = fn;
  }

  private static queryParser: QueryParser = (qs: string) => {
    if (!qs) return {};
    const out: Record<string, any> = {};
    const parts = qs.split('&');

    for (const part of parts) {
      if (!part) continue;

      const eq = part.indexOf('=');
      const key = decodeURIComponent(eq > 0 ? part.slice(0, eq) : part);
      const val = decodeURIComponent(eq > 0 ? part.slice(eq + 1) : '');

      if (val === 'true') out[key] = true;
      else if (val === 'false') out[key] = false;
      else if (!isNaN(+val) && val.trim() !== '') out[key] = +val;
      else out[key] = val;
    }

    return out;
  };

  private static paramsParser: ParamsParser = (pattern, url) => {
    const params: Record<string, string> = {};
    if (!pattern || pattern === url) return params;

    const pat = pattern.split('/');
    const seg = url.split('/');
    const len = Math.min(pat.length, seg.length);

    for (let i = 0; i < len; i++) {
      const p = pat[i];
      if (p && p.startsWith(':')) {
        params[p.slice(1)] = decodeURIComponent(seg[i] || '');
      }
    }

    return params;
  };
}
