import * as fs from 'node:fs';
import * as path from 'node:path';
import type { IResponse } from '../types/http.js';
import type { Ctx } from '@voltrix/server';
import { Renderer } from '../renderer.js';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
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

export class Response implements IResponse {
  public locals: Record<string, any> = {};

  constructor(
    private readonly _ctx: Ctx,
    private readonly _renderer: Renderer
  ) {
    this.locals = _ctx.locals;
  }

  get headersSent(): boolean {
    return this._ctx.sent;
  }

  get isAborted(): boolean {
    return this._ctx.aborted;
  }

  status(code: number): this {
    this._ctx.status(code);
    return this;
  }

  header(name: string, value: string): this;
  header(name: string): string | undefined;
  header(name: string, value?: string): this | string | undefined {
    if (value !== undefined) {
      this._ctx.setHeader(name, value);
      return this;
    }
    return undefined;
  }

  headers(): Record<string, string> {
    return this._ctx.headers();
  }

  type(contentType: string): this {
    this._ctx.setHeader('Content-Type', contentType);
    return this;
  }

  setHeader(name: string, value: string): this {
    this._ctx.setHeader(name, value);
    return this;
  }

  json(data: any): void {
    this._ctx.json(data);
  }

  sendBuffer(data: any): void {
    this._ctx.send(data);
  }

  send(data: string | Buffer): void {
    this._ctx.send(data);
  }

  end(data?: string | Uint8Array): void {
    if (data !== undefined) {
      this._ctx.send(data);
    } else {
      this._ctx.end();
    }
  }

  redirect(url: string, status = 302): void {
    this._ctx.redirect(url, status);
  }

  async render(view: string, options: Record<string, any> = {}, skipLayout = false): Promise<void> {
    if (this.isAborted || this._ctx.sent) return;

    try {
      const html = await this._renderer.viewRenderFile(view, options, skipLayout);
      if (this.isAborted || this._ctx.sent) return;

      const len = Buffer.byteLength(html);

      this._ctx.rawRes.cork(() => {
        this._ctx.rawRes.writeStatus('200 OK');
        this._ctx.rawRes.writeHeader('Content-Type', 'text/html; charset=utf-8');
        this._ctx.rawRes.writeHeader('Content-Length', len.toString());
        this._ctx.rawRes.end(html);
      });
    } catch (err: any) {
      const onError = this._renderer.viewGet('onError');
      let output: string;
      try {
        output = onError
          ? await onError(err instanceof Error ? err : new Error(String(err)), view, options)
          : `Render error: ${err instanceof Error ? err.message : String(err)}`;
      } catch (err: any) {
        output = `Render error: ${err instanceof Error ? err.message : String(err)}`;
      }

      if (!this._ctx.sent && !this.isAborted) {
        this._ctx.rawRes.cork(() => {
          this._ctx.rawRes.writeStatus('500 Internal Server Error');
          this._ctx.rawRes.writeHeader('Content-Type', 'text/html; charset=utf-8');
          this._ctx.rawRes.end(output);
        });
      }
    }
  }

  async sendFile(filePath: string): Promise<void> {
    if (this._ctx.sent || this.isAborted) return;

    return new Promise((resolve, reject) => {
      fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            return reject(err || new Error('Not a file'));
        }

        const size = stats.size;
        const contentType = this.getContentType(filePath);
        const raw = this._ctx.rawRes;

        raw.cork(() => {
          raw.writeStatus('200 OK');
          this._ctx.setHeader('Content-Type', contentType);
        });

        const fd = fs.openSync(filePath, 'r');
        let offset = 0;
        const buffer = Buffer.alloc(64 * 1024);

        const streamChunk = () => {
          if (this.isAborted || this._ctx.sent) {
            try { fs.closeSync(fd); } catch {}
            return;
          }

          const bytesRead = fs.readSync(fd, buffer, 0, buffer.length, offset);
          if (bytesRead === 0) {
            try { fs.closeSync(fd); } catch {}
            raw.end();
            resolve();
            return;
          }

          const chunk = buffer.subarray(0, bytesRead);
          const isLast = offset + bytesRead >= size;
          
          let ok = false;
          raw.cork(() => {
            if (isLast) {
              raw.end(chunk);
              ok = true;
            } else {
              ok = raw.tryEnd(chunk, size)[0];
            }
          });

          if (isLast) {
            try { fs.closeSync(fd); } catch {}
            resolve();
            return;
          }

          if (ok) {
            offset += bytesRead;
            process.nextTick(streamChunk);
          } else {
            raw.onWritable((newOffset: number) => {
              offset = newOffset;
              streamChunk();
              return true;
            });
          }
        };

        this._ctx.onAbort(() => {
          try { fs.closeSync(fd); } catch {}
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

  close(): void {
    this._ctx.end();
  }
}
