import { HttpResponse } from 'uWebSockets.js';
import type { HttpStatusCode } from './types.js';

export class Response {
  public finished = false;
  private readonly uwsRes: HttpResponse;
  private _statusCode = 200;
  private headers: Record<string, string> = {};
  private _headersSent = false;

  constructor(uwsRes: HttpResponse) {
    this.uwsRes = uwsRes;
  }

  /**
   * Set status code (Express-compatible with chaining)
   */
  status(code: HttpStatusCode | number): Response {
    if (this._headersSent) {
      throw new Error('Cannot set status after headers sent');
    }
    this._statusCode = code;
    return this;
  }

  /**
   * Set header value (Express-compatible with chaining)
   */
  set(name: string, value: string | string[]): Response {
    if (this._headersSent) {
      throw new Error('Cannot set headers after they are sent');
    }

    if (Array.isArray(value)) {
      this.headers[name] = value.join(', ');
    } else {
      this.headers[name] = value;
    }
    return this;
  }

  /**
   * Set multiple headers at once
   */
  setHeaders(headers: Record<string, string>): Response {
    Object.entries(headers).forEach(([name, value]) => {
      this.set(name, value);
    });
    return this;
  }

  /**
   * Get header value
   */
  get(name: string): string | undefined {
    return this.headers[name];
  }

  /**
   * Remove header
   */
  removeHeader(name: string): Response {
    if (this._headersSent) {
      throw new Error('Cannot remove headers after they are sent');
    }
    delete this.headers[name];
    return this;
  }

  /**
   * Send response with automatic content-type detection
   */
  send(data?: string | Uint8Array | object): void {
    if (this.finished) return;

    let body: string;
    let contentType = this.headers['Content-Type'] || this.headers['content-type'];

    if (data === undefined) {
      body = '';
    } else if (typeof data === 'string') {
      body = data;
      if (!contentType) {
        contentType = 'text/html; charset=utf-8';
      }
    } else if (data instanceof Uint8Array) {
      body = new TextDecoder().decode(data);
      if (!contentType) {
        contentType = 'application/octet-stream';
      }
    } else {
      body = JSON.stringify(data);
      if (!contentType) {
        contentType = 'application/json; charset=utf-8';
      }
    }

    // Set content type if not already set
    if (!this.headers['Content-Type'] && !this.headers['content-type'] && contentType) {
      this.set('Content-Type', contentType);
    }

    this.end(body);
  }

  /**
   * Send JSON response (Express-compatible)
   */
  json(data: unknown): void {
    this.set('Content-Type', 'application/json; charset=utf-8');
    this.end(JSON.stringify(data));
  }

  /**
   * Send text response
   */
  text(data: string): void {
    this.set('Content-Type', 'text/plain; charset=utf-8');
    this.end(data);
  }

  /**
   * Send HTML response
   */
  html(data: string): void {
    this.set('Content-Type', 'text/html; charset=utf-8');
    this.end(data);
  }

  /**
   * Redirect response (Express-compatible)
   */
  redirect(url: string): void;
  redirect(status: number, url: string): void;
  redirect(statusOrUrl: number | string, url?: string): void {
    if (typeof statusOrUrl === 'number') {
      this.status(statusOrUrl);
      this.set('Location', url!);
    } else {
      this.status(302);
      this.set('Location', statusOrUrl);
    }
    this.end();
  }

  file(path: string): void {
    this.uwsRes.sendFile(path);
  }

  /**
   * End response (low-level method)
   */
  end(data?: string): void {
    if (this.finished) return;

    this.finished = true;
    this._headersSent = true;

    try {
      // Write status
      this.uwsRes.writeStatus(this._statusCode.toString());

      // Write headers
      Object.entries(this.headers).forEach(([name, value]) => {
        this.uwsRes.writeHeader(name, value);
      });

      // End response with optional data
      if (data !== undefined) {
        this.uwsRes.end(data);
      } else {
        this.uwsRes.end();
      }
    } catch (error) {
      // Response may have been aborted
      console.warn('Failed to send response:', error);
    }
  }

  /**
   * Write data to response (for streaming)
   */
  write(chunk: string | Uint8Array): boolean {
    if (this.finished) {
      throw new Error('Cannot write after end');
    }

    if (!this._headersSent) {
      this.writeHead();
    }

    try {
      const data = chunk instanceof Uint8Array ? new TextDecoder().decode(chunk) : chunk;
      return this.uwsRes.write(data);
    } catch (error) {
      console.warn('Failed to write response chunk:', error);
      return false;
    }
  }

  /**
   * Write headers without ending response
   */
  writeHead(statusCode?: number, headers?: Record<string, string>): void {
    if (this._headersSent) {
      throw new Error('Headers already sent');
    }

    if (statusCode) {
      this._statusCode = statusCode;
    }

    if (headers) {
      Object.entries(headers).forEach(([name, value]) => {
        this.headers[name] = value;
      });
    }

    this._headersSent = true;

    try {
      // Write status
      this.uwsRes.writeStatus(this._statusCode.toString());

      // Write headers
      Object.entries(this.headers).forEach(([name, value]) => {
        this.uwsRes.writeHeader(name, value);
      });
    } catch (error) {
      console.warn('Failed to write headers:', error);
    }
  }

  /**
   * Cork response for efficient batching of writes
   */
  cork(callback: () => void): void {
    this.uwsRes.cork(callback);
  }

  /**
   * Get response status code
   */
  get statusCode(): number {
    return this._statusCode;
  }

  /**
   * Check if headers have been sent
   */
  get headersSent(): boolean {
    return this._headersSent;
  }
}
