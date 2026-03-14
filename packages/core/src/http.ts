
export interface IRequest {
  readonly method: string;
  readonly url: string;
  params: Record<string, string>;
  query: Record<string, any>;
  context: Record<string, any>;
  user?: any;

  buffer(): Promise<Uint8Array>;
  body(): Promise<string>;
  json<T = any>(): Promise<T>;
  onData(handler: (chunk: Uint8Array, isLast: boolean) => void): void;
  header(name: string): string | undefined;
  headers(): Record<string, string>;
  getParam(name: string): string | undefined;
  getQuery(name: string): any;
}

export interface IResponse {
  readonly headersSent: boolean;
  readonly isAborted: boolean;
  locals: Record<string, any>;

  json(data: any): void;
  send(data: string): void;
  status(code: number): IResponse;
  type(contentType: string): IResponse;
  end(data?: string | Uint8Array): void;
}

export type Middleware = (req: IRequest, res: IResponse, next: (err?: any) => void) => void;
