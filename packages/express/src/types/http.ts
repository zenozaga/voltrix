export interface IRequest {
  readonly method: string;
  readonly url: string;
  params: Record<string, string>;
  query: Record<string, any>;

  buffer(): Promise<Uint8Array>;
  body(): Promise<string>;
  json<T = any>(): Promise<T>;
  onData(handler: (chunk: Uint8Array, isLast: boolean) => void): void;

  header(name: string): string | undefined;
  headers(): Record<string, string>;
  getParam(name: string): string | undefined;
  getQuery(name: string): any;
  
  // High-level multipart helper
  parseMultipart(onPart: (part: any) => void | Promise<void>): Promise<void>;

  /**
   * Custom context for middleware data storage.
   * Reset on every request.
   */
  context: Record<string, any>;
}

export interface IResponse {
  readonly headersSent: boolean;
  readonly isAborted: boolean;

  /**
   * Data intended for templates or next middleware.
   * Reset on every request.
   */
  locals: Record<string, any>;

  json(data: any): void;
  send(data: string): void;
  status(code: number): IResponse;
  type(contentType: string): IResponse;
  end(data?: string | Uint8Array): void;
  redirect(url: string, status?: number): void;
  sendBuffer(data: ArrayBuffer | Buffer): void;
  sendFile(path: string): Promise<void>;

  // Header methods
  header(name: string, value: string): IResponse;
  header(name: string): string | undefined;
  setHeader(name: string, value: string): IResponse;
  headers(): Record<string, string>;
  render(view: string, options?: Record<string, any>, skipLayout?: boolean): void;
  close(): void;
}
