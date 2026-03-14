import { IRequest as CoreRequest, IResponse as CoreResponse } from '@voltrix/core';

export interface IRequest extends CoreRequest {
  // High-level multipart helper
  parseMultipart(onPart: (part: any) => void | Promise<void>): Promise<void>;
}

export interface IResponse extends CoreResponse {
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
