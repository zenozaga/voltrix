export interface IRequest {
  readonly method: string;
  readonly url: string;
  params: Record<string, string>;
  query: Record<string, any>;

  buffer(): Promise<Uint8Array>;
  body(): Promise<string>;
  json<T = any>(): Promise<T>;

  header(name: string): string | undefined;
  headers(): Record<string, string>;
  getParam(name: string): string | undefined;
  getQuery(name: string): any;
}

export interface IResponse {
  readonly headersSent: boolean;
  readonly isAborted: boolean;

  json(data: any): void;
  send(data: string): void;
  status(code: number): IResponse;
  type(contentType: string): IResponse;
  end(data?: string | Uint8Array): void;
  redirect(url: string, status?: number): void;
  sendBuffer(data: ArrayBuffer | Buffer): void;

  // Header methods
  header(name: string, value: string): IResponse;
  header(name: string): string | undefined;
  headers(): Record<string, string>;
  render(view: string, options?: Record<string, any>, skipLayout?: boolean): void;
  close(): void;
}
