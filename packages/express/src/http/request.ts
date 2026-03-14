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

  constructor() {
    // Initial state will be set by initialize()
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
    
    this._method = method;
    this._url = url;

    this.cachedBuffer = undefined;
    this.cachedBody = undefined;
    this.cachedJSON = undefined;
    this.detectedJSON = null;
    this.checkedJSON = false;
    this.cachedQuery = undefined;
    this.cachedParams = undefined;
  }

  private request!: HttpRequest;
  private response!: HttpResponse;

  // ================================================================
  // BUFFER → BODY → JSON  (High-performance implementation)
  // ================================================================

  async buffer(): Promise<Buffer> {
    if (this.cachedBuffer) return this.cachedBuffer;

    return (this.cachedBuffer = await new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];

      this.response.onData((ab, isLast) => {
        const chunk = Buffer.from(ab);

        // ------------------------------------------------------------
        // EARLY JSON DETECTION (best-practice)
        // ------------------------------------------------------------
        if (!this.checkedJSON) {
          for (let i = 0; i < chunk.length; i++) {
            const byte = chunk[i];

            // skip whitespace
            if (byte === 32 || byte === 9 || byte === 10 || byte === 13) continue;

            // '{' = 0x7B, '[' = 0x5B
            this.detectedJSON = byte === 0x7b || byte === 0x5b;
            this.checkedJSON = true;
            break;
          }
        }

        chunks.push(chunk);

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

    // Convert to JSON-like structure from Buffer
    const { data } = buf.toJSON();


    // ------------------------------------------------------------
    // STRICT JSON VALIDATION (FAST: check only 1 byte)
    // ------------------------------------------------------------
    //
    // 0x7B = '{'
    // 0x5B = '['
    //
    if (data.length === 0 || (data[0] !== 0x7b && data[0] !== 0x5b)) {
      throw new Error("Invalid JSON: body does not start with '{' or '['");
    }

    // ------------------------------------------------------------
    // Parse JSON
    // ------------------------------------------------------------
    try {
      return (this.cachedJSON = JSON.parse(Buffer.from(data) as unknown as string) as T);
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
    return this._method ||= this.request.getMethod().toUpperCase();
  }

  get url(): string {
    return this._url ||= this.request.getUrl();
  }

  get query(): Record<string, any> {
    if (!this.cachedQuery) {
      const qs = this.request.getQuery();
      this.cachedQuery = qs ? Request.queryParser(qs) : {};
    }
    return this.cachedQuery;
  }

  get params(): Record<string, string> {
    if (!this.routePattern) return (this.cachedParams ||= {});
    if (!this.cachedParams) {
      this.cachedParams = Request.paramsParser(this.routePattern, this.url);
    }
    return this.cachedParams;
  }

  getQuery(name: string): any {
    return this.query[name];
  }

  getParam(name: string): string | undefined {
    // FAST PATH: Use native uWS parameter by index if available
    if (this.paramIndices) {
      const index = this.paramIndices.get(name);
      if (index !== undefined) return this.request.getParameter(index);
    }
    
    // Fallback to JS parsing (for non-precomputed routes)
    return this.params[name];
  }

  header(name: string): string {
    return this.request.getHeader(name);
  }

  headers(): Record<string, string> {
    const result: Record<string, string> = {};
    this.request.forEach((k, v) => (result[k] = v));
    return result;
  }

  onData(handler: (chunk: Uint8Array, isLast: boolean) => void): void {
    if (this.cachedBuffer) {
      handler(this.cachedBuffer, true);
      return;
    }

    this.response.onData((ab, isLast) => {
      // Create a Uint8Array view of the ArrayBuffer
      // IMPORTANT: ab is only valid during the execution of this callback
      handler(new Uint8Array(ab), isLast);
    });
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
