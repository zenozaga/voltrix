export interface VoltrixRouter {
  // HTTP Routes
  get(path: string, handler: RouteHandler): VoltrixRouter;
  post(path: string, handler: RouteHandler): VoltrixRouter;
  put(path: string, handler: RouteHandler): VoltrixRouter;
  delete(path: string, handler: RouteHandler): VoltrixRouter;
  patch(path: string, handler: RouteHandler): VoltrixRouter;
  options(path: string, handler: RouteHandler): VoltrixRouter;
  head(path: string, handler: RouteHandler): VoltrixRouter;
  use(middleware: Middleware): VoltrixRouter;
  use(path: string, middleware: Middleware): VoltrixRouter;
  use(path: string, router: VoltrixRouter): VoltrixRouter;
}

export interface VoltrixApp {
  // HTTP Routes
  get(path: string, handler: RouteHandler): VoltrixApp;
  post(path: string, handler: RouteHandler): VoltrixApp;
  put(path: string, handler: RouteHandler): VoltrixApp;
  delete(path: string, handler: RouteHandler): VoltrixApp;
  patch(path: string, handler: RouteHandler): VoltrixApp;
  options(path: string, handler: RouteHandler): VoltrixApp;
  head(path: string, handler: RouteHandler): VoltrixApp;
  use(middleware: Middleware): VoltrixApp;
  use(path: string, middleware: Middleware): VoltrixApp;
  use(path: string, router: VoltrixRouter): VoltrixApp;
  
  // WebSocket Routes
  ws(path: string, handlers: {
    upgrade?: WebSocketUpgradeHandler;
    open?: WebSocketOpenHandler;
    message?: WebSocketMessageHandler;
    close?: WebSocketCloseHandler;
  }): VoltrixApp;
  
  // Error handling
  onError(handler: GlobalErrorHandler): VoltrixApp;
  onNotFound(handler: NotFoundHandler): VoltrixApp;
  
  // Server lifecycle
  listen(port: number, callback?: (success: boolean) => void): void;
  listen(port: number, host: string, callback?: (success: boolean) => void): void;
  getStats(): AppStats;
}

// Avoid conflicts with DOM types by using full import paths
import type { Request } from './request.js';
import type { Response } from './response.js';

export type RouteHandler = (req: Request, res: Response) => void | Promise<void>;

export type Middleware = (req: Request, res: Response, next: NextFunction) => void | Promise<void>;

export type ErrorMiddleware = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => void | Promise<void>;

export type NextFunction = (error?: Error) => void;

export type NotFoundHandler = (req: Request, res: Response) => void | Promise<void>;

export type GlobalErrorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => void | Promise<void>;

// WebSocket Types
export interface WebSocketData {
  userId?: string;
  sessionId?: string;
  [key: string]: any;
}

export interface WebSocket {
  send(message: string | ArrayBuffer | Uint8Array, isBinary?: boolean): void;
  close(): void;
  getRemoteAddressAsText(): ArrayBuffer;
  getUserData(): WebSocketData;
}

export type WebSocketMessageHandler = (
  ws: WebSocket,
  message: ArrayBuffer,
  opCode: number
) => void | Promise<void>;

export type WebSocketOpenHandler = (ws: WebSocket) => void | Promise<void>;

export type WebSocketCloseHandler = (
  ws: WebSocket,
  code: number,
  message: ArrayBuffer
) => void | Promise<void>;

export type WebSocketUpgradeHandler = (
  res: Response,
  req: Request,
  context: any
) => void | Promise<void>;

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

export interface RequestParams {
  [key: string]: string;
}

export interface RequestQuery {
  [key: string]: string | string[] | undefined;
}

export interface RequestHeaders {
  [key: string]: string | undefined;
}

export interface RouteMatch {
  handler: RouteHandler;
  params: RequestParams;
}

export interface Route {
  method: string;
  pattern: string;
  handler: RouteHandler;
  regex?: RegExp;
  paramNames?: string[];
}

export interface MiddlewareEntry {
  path?: string;
  handler: Middleware;
}

// Performance-focused interfaces
export interface ObjectPool<T> {
  acquire(): T;
  release(obj: T): void;
  size(): number;
  clear(): void;
}

export interface PerformanceMetrics {
  requestCount: number;
  totalDuration: number;
  averageLatency: number;
  memoryUsage: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
    arrayBuffers: number;
  };
}

// HTTP Status codes for performance (avoid string lookups)
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  INTERNAL_SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
} as const;

export type HttpStatusCode = (typeof HTTP_STATUS)[keyof typeof HTTP_STATUS];

// Statistics interfaces
export interface AppStats {
  routes: {
    totalRoutes: number;
    staticRoutes: number;
    paramRoutes: number;
    wildcardRoutes: number;
  };
  websockets: {
    totalWebSockets: number;
    activeConnections: number;
  };
  middleware: {
    globalMiddleware: number;
    routeMiddleware: number;
  };
}