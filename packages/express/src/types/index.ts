/**
 * Voltrix Types - Centralized type exports
 *
 * This file re-exports all types from organized modules for clean imports
 */

// HTTP and Core types
export type { IRequest, IResponse } from './http.js';

// Middleware types
export type {
  NextFunction,
  Middleware,
  ErrorMiddleware,
  HandlerFunction,
  GlobalErrorHandler,
  MiddlewareEntry,
} from './handlers.js';

// WebSocket types
export type {
  WebSocketData,
  WebSocket,
  WebSocketMessageHandler,
  WebSocketOpenHandler,
  WebSocketCloseHandler,
  WebSocketUpgradeHandler,
  WebSocketRoute,
} from './websocket.js';

// Performance and stats
export type { PerformanceMetrics, ObjectPool, AppStats } from './performance.js';
