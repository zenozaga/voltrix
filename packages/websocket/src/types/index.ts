import type { IRequest, IResponse } from '@voltrix/core';

/**
 * 🔌 Core WsSocket normalization interface wrapper.
 * Encapsulates client socket operations for engine-agnostic code.
 */
export interface WsSocket<TUser = any, TRawSocket = any> {
  /**
   * Unique connection ID.
   */
  readonly id: string;

  /**
   * Authenticated user object/context.
   */
  user?: TUser;

  /**
   * Send a message to this specific client.
   */
  send(message: string | ArrayBufferView | ArrayBuffer, isBinary?: boolean): void;

  /**
   * Subscribe this client to a room/topic.
   */
  subscribe(topic: string): void;

  /**
   * Unsubscribe this client from a room/topic.
   */
  unsubscribe(topic: string): void;

  /**
   * Publish a message to a topic.
   */
  publish(topic: string, message: string | ArrayBufferView | ArrayBuffer, isBinary?: boolean): void;

  /**
   * Close the connection securely.
   */
  close(code?: number, reason?: string): void;

  /**
   * The raw underlying engine socket instance (e.g. uWS.WebSocket).
   */
  readonly raw: TRawSocket;
}

/**
 * 🎯 Structure of a registered message handler.
 */
export interface WsMessageHandler<TClient extends WsSocket = WsSocket> {
  readonly event: string;
  readonly handler: (client: TClient, data: any) => void | Promise<void>;
}

/**
 * 🔌 Pluggable WebSocket Adapter Contract.
 */
export interface IWebSocketAdapter<
  TServer = any,
  TClient extends WsSocket = WsSocket,
  TOptions = any
> {
  /**
   * Creates the WebSocket server.
   */
  create(port: number, options?: TOptions): TServer;

  /**
   * Binds callback to client connection events.
   */
  bindClientConnect(
    server: TServer,
    callback: (client: TClient) => void | Promise<void>
  ): void;

  /**
   * Binds callback to client disconnection events.
   */
  bindClientDisconnect(
    client: TClient,
    callback: (client: TClient, code: number, reason: ArrayBuffer) => void | Promise<void>
  ): void;

  /**
   * Binds handlers for events sent by the client.
   */
  bindMessageHandlers(client: TClient, handlers: WsMessageHandler<TClient>[]): void;

  /**
   * Closes the server.
   */
  close(): void | Promise<void>;
}

/**
 * 📡 Pluggable Pub/Sub and Distributed Broadcasting Engine.
 */
export interface IPubSubEngine<
  TClient extends WsSocket = WsSocket,
  TPayload = any
> {
  /**
   * Subscribes a client to a topic.
   */
  subscribe(client: TClient, topic: string): void | Promise<void>;

  /**
   * Unsubscribes a client from a topic.
   */
  unsubscribe(client: TClient, topic: string): void | Promise<void>;

  /**
   * Publishes a message to a topic.
   */
  publish(topic: string, message: TPayload, isBinary?: boolean): void | Promise<void>;

  /**
   * Broadcasts a message globally to all connections.
   */
  broadcast(message: TPayload, isBinary?: boolean): void | Promise<void>;
}

/**
 * 🔒 Handshake Context for Pre-Upgrade Authentication.
 */
export interface HandshakeContext<TUser = any> {
  /**
   * Returns the underlying HTTP Request interface.
   */
  getRequest(): IRequest;

  /**
   * Returns the underlying HTTP Response interface.
   */
  getResponse(): IResponse;

  /**
   * Sets the resolved/authenticated user metadata.
   */
  setUser(user: TUser): void;

  /**
   * Gets the active user metadata.
   */
  getUser(): TUser | undefined;
}

/**
 * 📨 WebSocket Message Context for Pipelines.
 */
export interface WsMessageContext<TUser = any> {
  /**
   * The client socket that sent the message.
   */
  readonly client: WsSocket<TUser>;

  /**
   * The event name.
   */
  readonly event: string;

  /**
   * The parsed payload.
   */
  payload: any;
}

/**
 * ⚙️ Interceptor / Middleware for message events.
 */
export type WsMiddleware<TUser = any> = (
  context: WsMessageContext<TUser>,
  next: (err?: Error) => void | Promise<void>
) => void | Promise<void>;
