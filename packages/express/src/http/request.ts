import type { IRequest } from '../types/http.js';
import type { Ctx } from '@voltrix/server';
import { parseMultipart, MultipartPart } from '../common/multipart.js';

export class Request implements IRequest {
  public context: Record<string, any>;
  
  constructor(private readonly _ctx: Ctx) {
    this.context = _ctx.locals as Record<string, any>;
  }

  async buffer(): Promise<Buffer> {
    return this._ctx.buffer();
  }

  async body(): Promise<string> {
    return this._ctx.text();
  }

  async json<T = any>(): Promise<T> {
    return this._ctx.readJson<T>();
  }

  get method(): string {
    return this._ctx.method;
  }

  get url(): string {
    return this._ctx.url;
  }

  get query(): Record<string, any> {
    return this._ctx.query as Record<string, any>;
  }

  get params(): Record<string, string> {
    return this._ctx.params;
  }

  getQuery(name: string): any {
    return this._ctx.query[name];
  }

  getParam(name: string): string | undefined {
    return this._ctx.params[name];
  }

  header(name: string): string | undefined {
    return this._ctx.header(name);
  }

  headers(): Record<string, string> {
    return this._ctx.headers();
  }

  onData(handler: (chunk: Uint8Array, isLast: boolean) => void): void {
    this._ctx.rawRes.onData((ab: ArrayBuffer, isLast: boolean) => {
      handler(new Uint8Array(ab), isLast);
    });
  }

  async parseMultipart(onPart: (part: MultipartPart) => void | Promise<void>): Promise<void> {
    return parseMultipart(this, onPart);
  }
}
