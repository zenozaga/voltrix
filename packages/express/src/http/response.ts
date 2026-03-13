import type { HttpResponse } from 'uWebSockets.js';
import type { IResponse } from '../types/http.js';
import { Renderer } from '../renderer.js';
import { STATUS_TEXT, StatusCode } from '../common/constants.js';
import { normalizeBodyForUWS, BodyInput } from '../common/normalize-data.js';

export class Response implements IResponse {
  private _headers: Record<string, string> = {};
  private _statusCode = 200;
  private _sent = false;

  isAborted = false;
  onFinished?: () => void;

  constructor() {
    // Initial state set by initialize()
  }

  /**
   * Reset instance for reuse in ObjectPool
   */
  initialize(raw: HttpResponse, renderer: Renderer, onFinished?: () => void): void {
    this.raw = raw;
    this.renderer = renderer;
    this._headers = {};
    this._statusCode = 200;
    this._sent = false;
    this.isAborted = false;
    this.onFinished = onFinished;

    this.raw.onAborted(() => {
      this.isAborted = true;
      if (this.onFinished) {
        this.onFinished();
        this.onFinished = undefined;
      }
    });
  }

  private finished(): void {
    if (this.onFinished) {
      this.onFinished();
      this.onFinished = undefined;
    }
  }

  private raw!: HttpResponse;
  private renderer!: Renderer;

  // ============================================
  // BASIC PROPERTIES
  // ============================================
  get headersSent(): boolean {
    return this._sent;
  }

  // ============================================
  // STATUS
  // ============================================
  status(code: number): this {
    this._statusCode = code;
    return this;
  }

  // ============================================
  // HEADERS
  // ============================================
  header(name: string, value: string): this;
  header(name: string): string | undefined;

  header(name: string, value?: string): this | string | undefined {
    if (value !== undefined) {
      this._headers[name] = value;
      return this;
    }
    return this._headers[name];
  }

  headers(): Record<string, string> {
    return this._headers;
  }

  type(contentType: string): this {
    return this.header('Content-Type', contentType);
  }

  // ============================================
  // JSON
  // ============================================
  json(data: any): void {
    if (this._sent || this.isAborted) return;

    const body = JSON.stringify(data);
    this.header('Content-Type', 'application/json; charset=utf-8');

    this._sendInternal(body);
  }

  // ============================================
  // SEND BUFFER (delegates to _sendInternal)
  // ============================================
  sendBuffer(data: BodyInput): void {
    if (this._sent || this.isAborted) return;

    const normalized = normalizeBodyForUWS(data);

    this.header('Content-Type', 'application/octet-stream');
    this._sendInternal(normalized);
  }

  // ============================================
  // SEND (string or Buffer)
  // ============================================
  send(data: string | Buffer): void {
    if (this._sent || this.isAborted) return;

    const normalized = normalizeBodyForUWS(data);
    this._sendInternal(normalized);
  }

  // ============================================
  // INTERNAL SEND — all data passes through here
  // ============================================
  private _sendInternal(body: BodyInput): void {
    if (this._sent || this.isAborted) return;
    this._sent = true;

    // Body is ALREADY normalized by send() or json() callers in many cases
    // but we normalize here to be sure, then use it directly in end()
    const payload = normalizeBodyForUWS(body);

    this.raw.cork(() => {
      const text = STATUS_TEXT[this._statusCode as StatusCode];
      const statusLine = text ? `${this._statusCode} ${text}` : `${this._statusCode}`;

      this.raw.writeStatus(statusLine);

      for (const key in this._headers) {
        this.raw.writeHeader(key, this._headers[key]);
      }

      this.raw.end(payload);
      this.finished();
    });
  }

  // ============================================
  // END
  // ============================================
  end(data: string | Uint8Array = ''): void {
    if (this._sent || this.isAborted) return;
    
    const payload = normalizeBodyForUWS(data);
    this._sendInternal(payload);
  }

  // ============================================
  // REDIRECT
  // ============================================
  redirect(url: string, status = 302): void {
    if (this._sent || this.isAborted) return;

    this.status(status);
    this.header('Location', url);
    this.header('Content-Length', '0');

    this._sendInternal('');
  }

  // ============================================
  // RENDER (HTML)
  // ============================================
  async render(view: string, options: Record<string, any> = {}, skipLayout = false): Promise<void> {
    if (this.isAborted || this._sent) return;

    if (!this.renderer) {
      this.status(500).send('Renderer not available');
      return;
    }

    try {
      const html = await this.renderer.viewRenderFile(view, options, skipLayout);
      if (this.isAborted || this._sent) return;

      const len = Buffer.byteLength(html);

      this.raw.cork(() => {
        this.raw.writeStatus('200 OK');
        this.raw.writeHeader('Content-Type', 'text/html; charset=utf-8');
        this.raw.writeHeader('Content-Length', len.toString());
        this.raw.end(html);
        this.finished();
      });
    } catch (err: any) {
      const onError = this.renderer.viewGet('onError');

      let output: string;

      try {
        output = onError
          ? await onError(err, view, options)
          : `Render error: ${err?.message ?? 'Unknown error'}`;
      } catch {
        output = `Render error: ${err?.message ?? 'Unknown error'}`;
      }

      if (!this._sent && !this.isAborted) {
        this.raw.cork(() => {
          this.raw.writeStatus('500 Internal Server Error');
          this.raw.writeHeader('Content-Type', 'text/html; charset=utf-8');
          this.raw.end(output);
          this.finished();
        });
      }
    }
  }

  // ============================================
  // CLOSE
  // ============================================
  close(): void {
    if (!this._sent && !this.isAborted) {
      this._sent = true;
      this.raw.cork(() => {
        this.raw.end();
        this.finished();
      });
    }
  }
}
