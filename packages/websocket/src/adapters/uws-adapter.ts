import type { IRequest, IResponse } from '@voltrix/core';
import type { IWebSocketAdapter, WsSocket, WsMessageHandler } from '../types/index.js';

/**
 * 📦 Options for configuring the uWebSockets.js Adapter
 */
export interface UwsAdapterOptions {
  app?: any;
  path?: string;
  maxPayloadLength?: number;
  idleTimeout?: number;
  compression?: number;
  maxBackpressure?: number;
  onUpgrade?: (req: IRequest, res: IResponse) => any | Promise<any>;
}

/**
 * 📨 Heap-allocated request clone to bypass uWebSockets.js stack-allocation lifetime limitations.
 */
export class HeapRequest implements IRequest {
  private readonly _headers: Record<string, string> = {};
  readonly query: Record<string, any> = {};
  readonly cookies: Record<string, string> = {};
  readonly url: string;
  readonly method: string;
  readonly ip: string;
  readonly params: Record<string, string> = {};
  readonly context: Record<string, any> = {};
  user?: any;

  constructor(req: any, ip: string) {
    this.url = req.getUrl();
    this.method = req.getMethod().toUpperCase();
    this.ip = ip;

    // Synchronously copy all headers
    req.forEach((key: string, val: string) => {
      this._headers[key.toLowerCase()] = val;
    });

    // Synchronously parse query string
    const queryStr = req.getQuery();
    if (queryStr) {
      const searchParams = new URLSearchParams(queryStr);
      for (const [key, val] of searchParams.entries()) {
        this.query[key] = val;
      }
    }

    // Synchronously parse cookies
    const cookieHeader = this._headers['cookie'];
    if (cookieHeader) {
      cookieHeader.split(';').forEach((cookie) => {
        const parts = cookie.split('=');
        const k = parts[0]?.trim();
        const v = parts.slice(1).join('=').trim();
        if (k) this.cookies[k] = v;
      });
    }
  }

  header(name: string): string | undefined {
    return this._headers[name.toLowerCase()];
  }

  headers(): Record<string, string> {
    return this._headers;
  }

  getParam(name: string): string | undefined {
    return this.params[name];
  }

  getQuery(name: string): any {
    return this.query[name];
  }

  buffer(): Promise<Uint8Array> {
    return Promise.resolve(new Uint8Array(0));
  }

  body(): Promise<string> {
    return Promise.resolve('');
  }

  json<T = any>(): Promise<T> {
    return Promise.resolve({} as T);
  }

  onData(handler: (chunk: Uint8Array, isLast: boolean) => void): void {
    // No-op for upgrade requests
  }
}

/**
 * 🔒 Minimal HTTP Response wrapper for validation failures during Handshake/Upgrade phase
 */
export class UpgradeResponse implements IResponse {
  private _status = '200 OK';
  private _headers: Record<string, string> = {};
  readonly raw: any;
  headersSent = false;
  isAborted = false;
  locals: Record<string, any> = {};

  constructor(res: any) {
    this.raw = res;
    res.onAborted(() => {
      this.isAborted = true;
    });
  }

  setHeader(name: string, value: string): IResponse {
    this._headers[name] = value;
    return this;
  }

  json(data: any): void {
    this.setHeader('Content-Type', 'application/json');
    this.send(JSON.stringify(data));
  }

  send(data: string): void {
    if (this.isAborted) return;
    this.headersSent = true;
    this.raw.cork(() => {
      this.raw.writeStatus(this._status);
      Object.entries(this._headers).forEach(([k, v]) => {
        this.raw.writeHeader(k, v);
      });
      this.raw.end(data);
    });
  }

  status(code: number): IResponse {
    switch (code) {
      case 400: this._status = '400 Bad Request'; break;
      case 401: this._status = '401 Unauthorized'; break;
      case 403: this._status = '403 Forbidden'; break;
      case 429: this._status = '429 Too Many Requests'; break;
      case 500: this._status = '500 Internal Server Error'; break;
      default: this._status = `${code} Custom`;
    }
    return this;
  }

  type(contentType: string): IResponse {
    this.setHeader('Content-Type', contentType);
    return this;
  }

  end(data?: string | Uint8Array): void {
    if (this.isAborted) return;
    this.headersSent = true;
    this.raw.cork(() => {
      this.raw.writeStatus(this._status);
      Object.entries(this._headers).forEach(([k, v]) => {
        this.raw.writeHeader(k, v);
      });
      this.raw.end(data || '');
    });
  }
}

/**
 * 🔌 Engine Socket wrapper mapping directly onto C++ uWebSockets.js instance.
 */
export class UwsSocket<TUser = any> implements WsSocket<TUser, any> {
  readonly id: string;
  user?: TUser;

  constructor(
    private readonly ws: any,
    readonly raw: any
  ) {
    this.id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    
    const data = ws.getUserData();
    if (data && data.user) {
      this.user = data.user;
    }
  }

  send(message: string | ArrayBufferView | ArrayBuffer, isBinary?: boolean): void {
    this.ws.send(message, isBinary);
  }

  subscribe(topic: string): void {
    this.ws.subscribe(topic);
  }

  unsubscribe(topic: string): void {
    this.ws.unsubscribe(topic);
  }

  publish(topic: string, message: string | ArrayBufferView | ArrayBuffer, isBinary?: boolean): void {
    this.ws.publish(topic, message, isBinary);
  }

  close(code?: number, reason?: string): void {
    this.ws.end(code, reason);
  }
}

/**
 * 🚀 High-performance uWebSockets.js Adapter.
 */
export class UwsWebSocketAdapter implements IWebSocketAdapter<any, UwsSocket, UwsAdapterOptions> {
  private serverApp: any = null;
  private isStandalone = false;
  private readonly socketMap = new WeakMap<any, UwsSocket>();
  
  private onConnectCallback?: (client: UwsSocket) => void | Promise<void>;
  private onDisconnectCallback?: (client: UwsSocket, code: number, reason: ArrayBuffer) => void | Promise<void>;
  private readonly globalHandlers = new Map<string, (client: UwsSocket, data: any) => void | Promise<void>>();

  create(port: number, options: UwsAdapterOptions = {}): any {
    const uWSModule = require('uWebSockets.js');
    this.serverApp = options.app || uWSModule.App({});
    this.isStandalone = !options.app;

    const path = options.path || '/ws';
    const maxPayloadLength = options.maxPayloadLength ?? 16 * 1024 * 1024;
    const idleTimeout = options.idleTimeout ?? 120;
    const compression = options.compression ?? 0;
    const maxBackpressure = options.maxBackpressure ?? 1024 * 1024;

    this.serverApp.ws(path, {
      compression,
      maxPayloadLength,
      idleTimeout,
      maxBackpressure,

      upgrade: async (res: any, req: any, context: any) => {
        let aborted = false;
        res.onAborted(() => {
          aborted = true;
        });

        const remoteIp = Buffer.from(res.getRemoteAddressAsText()).toString();
        const heapReq = new HeapRequest(req, remoteIp);
        const uwsKey = req.getHeader('sec-websocket-key');
        const uwsProtocol = req.getHeader('sec-websocket-protocol');
        const uwsExtensions = req.getHeader('sec-websocket-extensions');

        try {
          let userContext: any = null;

          if (options.onUpgrade) {
            const wrapRes = new UpgradeResponse(res);
            userContext = await options.onUpgrade(heapReq, wrapRes);
            
            if (wrapRes.isAborted || aborted) return;

            if (userContext === false) {
              wrapRes.status(401).json({ error: 'Unauthorized', message: 'Handshake validation failed' });
              return;
            }
          }

          if (!aborted) {
            res.upgrade(
              { user: userContext || heapReq.user },
              uwsKey,
              uwsProtocol,
              uwsExtensions,
              context
            );
          }
        } catch (err: any) {
          if (!aborted) {
            const wrapRes = new UpgradeResponse(res);
            wrapRes.status(500).json({ error: 'Internal Server Error', message: err.message });
          }
        }
      },

      open: (ws: any) => {
        const socket = this.getOrCreateSocket(ws);
        if (this.onConnectCallback) {
          this.onConnectCallback(socket);
        }
      },

      message: (ws: any, message: ArrayBuffer, isBinary: boolean) => {
        const socket = this.getOrCreateSocket(ws);
        const payloadStr = Buffer.from(message).toString('utf8');

        try {
          const packet = JSON.parse(payloadStr);
          if (packet && typeof packet === 'object' && packet.event) {
            const handler = this.globalHandlers.get(packet.event);
            if (handler) {
              handler(socket, packet.data);
            }
          }
        } catch (err) {
          // Stable under spam
        }
      },

      close: (ws: any, code: number, message: ArrayBuffer) => {
        const socket = this.getOrCreateSocket(ws);
        if (this.onDisconnectCallback) {
          this.onDisconnectCallback(socket, code, message);
        }
        this.socketMap.delete(ws);
      }
    });

    if (this.isStandalone) {
      this.serverApp.listen(port, (token: any) => {
        if (!token) {
          throw new Error(`Failed to start standalone uWS WebSocket Server on port ${port}`);
        }
      });
    }

    return this.serverApp;
  }

  bindClientConnect(server: any, callback: (client: UwsSocket) => void | Promise<void>): void {
    this.onConnectCallback = callback;
  }

  bindClientDisconnect(client: UwsSocket, callback: (client: UwsSocket, code: number, reason: ArrayBuffer) => void | Promise<void>): void {
    this.onDisconnectCallback = callback;
  }

  bindMessageHandlers(client: UwsSocket, handlers: WsMessageHandler<UwsSocket>[]): void {
    handlers.forEach((h) => {
      this.globalHandlers.set(h.event, h.handler);
    });
  }

  getOrCreateSocket(rawWs: any): UwsSocket {
    let socket = this.socketMap.get(rawWs);
    if (!socket) {
      socket = new UwsSocket(rawWs, rawWs);
      this.socketMap.set(rawWs, socket);
    }
    return socket;
  }

  close(): void | Promise<void> {
    if (this.isStandalone && this.serverApp) {
      // Standalone server cleanup
    }
  }
}
