import type { HttpResponse } from 'uWebSockets.js';
import { IResponse } from '../types/http.js';
import { Renderer } from '../renderer.js';

export class Response implements IResponse {
  private _headers: Record<string, string> = {};
  private _statusCode = 200;
  private _sent = false;
  isAborted = false;

  constructor(
    private raw: HttpResponse,
    private renderer: Renderer
  ) {
    raw.onAborted(() => {
      this.isAborted = true;
    });
  }

  status(code: number): this {
    this._statusCode = code;
    return this;
  }

  ////////////////////////
  /// Headers Methods
  ////////////////////////

  get headersSent(): boolean {
    return this._sent;
  }

  header(field: string, value: string): this;
  header(field: string): string | undefined;

  header(field: string, value?: string): string | this | undefined {
    if (value !== undefined) {
      this._headers[field] = value;
      return this;
    }

    return this._headers[field];
  }

  headers(): Record<string, string> {
    return this._headers;
  }

  ///////////////////////
  /// Response Methods
  ///////////////////////

  type(contentType: string): this {
    this.header('Content-Type', contentType);
    return this;
  }

  json(data: any): void {
    if (this._sent) return;
    this.header('Content-Type', 'application/json; charset=utf-8');
    this.send(JSON.stringify(data));
  }

  sendBuffer(data: Buffer<ArrayBufferLike>): void {
    if (this._sent) return;
    this.header('Content-Type', 'application/octet-stream');
    this.send(data);
  }

  send(body: string | Buffer): void {
    if (this._sent) return;
    this._sent = true;

    // Write status and headers
    this.raw.writeStatus(this._statusCode.toString());

    // Write all headers
    for (const entry in this._headers) {
      if (!this._headers[entry]) continue;
      this.raw.writeHeader(entry, this._headers[entry]);
    }

    this.raw.end(body);
  }

  end(body?: string | Buffer): void {
    if (this._sent) return;
    this._sent = true;
    this.raw.cork(() => this.raw.end(body ?? ''));
  }

  redirect(url: string, status: number = 302): void {
    if (this._sent) return;
    this.status(status);
    this.header('Location', url);
    this.send('');
  }

  /**
   * Render a view using the global Renderer system.
   * Fully supports hooks, layouts, and custom onError handlers.
   */
  async render(view: string, data: Record<string, any> = {}, skipLayout = false): Promise<void> {
    if (this.isAborted || this.headersSent) return;

    if (!this.renderer) {
      this.status(500).send('Renderer not available');
      return;
    }

    try {
      const html = await this.renderer.viewRenderFile(view, data, skipLayout);
      if (this.isAborted || this.headersSent) return;

      this.raw.cork(() => {
        this.raw.writeHeader('Content-Type', 'text/html; charset=utf-8');
        this.raw.end(html);
      });
    } catch (err: any) {
      // Handle with renderer's onError if available
      const onError = this.renderer.viewGet('onError');
      let output: string | undefined;

      if (onError) {
        try {
          output = await onError(err, view, data);
        } catch (hookErr) {
          output = `Render error (in onError): ${(hookErr as Error).message}`;
        }
      }

      if (!output) {
        output = `Render error: ${err?.message || 'Unknown error'}`;
      }

      if (!this.isAborted && !this.headersSent) {
        this.raw.cork(() => {
          this.raw.writeStatus('500');
          this.raw.writeHeader('Content-Type', 'text/html; charset=utf-8');
          this.raw.end(output);
        });
      }
    }
  }

  close() {
    if (!this._sent) {
      this._sent = true;
      this.raw.cork(() => this.raw.end());
    }
  }
}
