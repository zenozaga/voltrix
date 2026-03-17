import type { HttpResponse } from 'uWebSockets.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
  '.woff': 'application/font-woff',
  '.ttf': 'application/font-ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.otf': 'application/font-otf',
  '.wasm': 'application/wasm',
};
import type { IResponse } from '../types/http.js';
import { Renderer } from '../renderer.js';
import { STATUS_TEXT, StatusCode, STATUS_LINES } from '../common/constants.js';
import { normalizeBodyForUWS, BodyInput } from '../common/normalize-data.js';

export class Response implements IResponse {
  public _headers: Record<string, string> = {};
  public _headerNames: string[] = [];
  private _headerLowerMap: Map<string, string> = new Map(); // lowercase → original casing
  public locals: Record<string, any> = {};
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
    this._headerNames = [];
    this._headerLowerMap = new Map();
    this._statusCode = 200;
    this._sent = false;
    this.isAborted = false;
    this.onFinished = onFinished;
    this.locals = {};

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
      const lower = name.toLowerCase();
      if (!this._headerLowerMap.has(lower)) {
        this._headerLowerMap.set(lower, name);
        this._headerNames.push(name);
      }
      this._headers[name] = value;
      return this;
    }
    return this._headers[name];
  }

  headers(): Record<string, string> {
    return this._headers;
  }

  type(contentType: string): this {
    return this.setHeader('Content-Type', contentType);
  }

  setHeader(name: string, value: string): this {
    const lower = name.toLowerCase();
    const existing = this._headerLowerMap.get(lower);
    if (existing !== undefined) {
      this._headers[existing] = value;
    } else {
      this._headerLowerMap.set(lower, name);
      this._headerNames.push(name);
      this._headers[name] = value;
    }
    return this;
  }

  // ============================================
  // JSON
  // ============================================
  json(data: any): void {
    if (this._sent || this.isAborted) return;

    const body = JSON.stringify(data);
    this.setHeader('Content-Type', 'application/json; charset=utf-8');

    this._sendInternal(body);
  }

  // ============================================
  // SEND BUFFER (delegates to _sendInternal)
  // ============================================
  sendBuffer(data: BodyInput): void {
    if (this._sent || this.isAborted) return;

    const normalized = normalizeBodyForUWS(data);

    this.setHeader('Content-Type', 'application/octet-stream');
    this._sendInternal(normalized);
  }

  // ============================================
  // SEND (string or Buffer)
  // ============================================
  send(data: string | Buffer): void {
    if (this._sent || this.isAborted) return;

    this._sendInternal(data);
  }

  // ============================================
  // INTERNAL SEND — all data passes through here
  // ============================================
  private _sendInternal(body: BodyInput): void {
    if (this._sent || this.isAborted) return;
    this._sent = true;

    const payload = normalizeBodyForUWS(body);

    this.raw.cork(() => {
      const statusLine = STATUS_LINES[this._statusCode] || `${this._statusCode} ${STATUS_TEXT[this._statusCode as StatusCode] || 'Unknown'}`;
      this.raw.writeStatus(statusLine);

      // Ensure standard headers are present if not already set
      if (!this.header('Content-Type')) {
        this.setHeader('Content-Type', 'text/plain; charset=utf-8');
      }

      const names = this._headerNames;
      const headers = this._headers;
      for (let i = 0; i < names.length; i++) {
        this.raw.writeHeader(names[i], headers[names[i]]);
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
  // SEND FILE (optimized with backpressure)
  // ============================================
  async sendFile(filePath: string): Promise<void> {
    if (this._sent || this.isAborted) return;
    this._sent = true;

    return new Promise((resolve, reject) => {
      fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            this._sent = false; // Reset sent to allow error handling
            return reject(err || new Error('Not a file'));
        }

        const size = stats.size;
        const contentType = this.getContentType(filePath);
        
        this.raw.cork(() => {
          this.raw.writeStatus(STATUS_LINES[200]);
          
          // Clear any conflicting headers set before
          this.setHeader('Content-Type', contentType);

          const names = this._headerNames;
          const headers = this._headers;
          for (let i = 0; i < names.length; i++) {
            const name = names[i];
            if (name.toLowerCase() === 'content-length') continue;
            this.raw.writeHeader(name, headers[name]);
          }
        });

        // Setup streaming
        const fd = fs.openSync(filePath, 'r');
        let offset = 0;
        const buffer = Buffer.alloc(64 * 1024); // 64KB chunks

        const streamChunk = () => {
          if (this.isAborted) {
            fs.closeSync(fd);
            this.finished();
            return;
          }

          const bytesRead = fs.readSync(fd, buffer, 0, buffer.length, offset);
          if (bytesRead === 0) {
            fs.closeSync(fd);
            this.raw.end();
            this.finished();
            resolve();
            return;
          }

          const chunk = buffer.subarray(0, bytesRead);
          const isLast = offset + bytesRead >= size;
          
          let ok = false;
          this.raw.cork(() => {
            if (isLast) {
              this.raw.end(chunk);
              ok = true;
            } else {
              ok = this.raw.tryEnd(chunk, size)[0];
            }
          });

          if (isLast) {
            fs.closeSync(fd);
            this.finished();
            resolve();
            return;
          }

          if (ok) {
            offset += bytesRead;
            // Immediate next chunk if it fits in buffer
            process.nextTick(streamChunk);
          } else {
            // Wait for writability
            this.raw.onWritable((newOffset) => {
              offset = newOffset;
              streamChunk();
              return true;
            });
          }
        };

        this.raw.onAborted(() => {
          this.isAborted = true;
          if (fd !== undefined) {
            try {
              fs.closeSync(fd);
            } catch (e) {
              // Ignore already closed or invalid fd
            }
          }
          this.finished();
          reject(new Error('Aborted'));
        });

        streamChunk();
      });
    });
  }

  private getContentType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    return MIME_TYPES[ext] ?? 'application/octet-stream';
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
