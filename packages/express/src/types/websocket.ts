/**
 * WebSocket types and interfaces for Voltrix
 */

import type { WebSocket as UWSWebSocket, WebSocketBehavior } from 'uWebSockets.js';
// Using generic req/res types since VoltrixUltra enriches them at runtime
type Request = any;
type Response = any;

// Re-export WebSocket type from uWS
export type WebSocket<T = any> = UWSWebSocket<T>;

// WebSocket Data
export interface WebSocketData {
  userId?: string;
  sessionId?: string;
  [key: string]: any;
}

// WebSocket Handler Types
export type WebSocketMessageHandler<T = any> = (
  ws: WebSocket<T>,
  message: ArrayBuffer,
  opCode: number
) => void | Promise<void>;

export type WebSocketOpenHandler<T = any> = (ws: WebSocket<T>) => void | Promise<void>;

export type WebSocketCloseHandler<T = any> = (
  ws: WebSocket<T>,
  code: number,
  message: ArrayBuffer
) => void | Promise<void>;

export type WebSocketUpgradeHandler = (
  res: Response,
  req: Request,
  context: any
) => void | Promise<void>;

// WebSocket Route
export interface WebSocketRoute {
  pattern: string;
  handlers: {
    upgrade?: WebSocketUpgradeHandler;
    open?: WebSocketOpenHandler;
    message?: WebSocketMessageHandler;
    close?: WebSocketCloseHandler;
  };
  userData?: any;
}
