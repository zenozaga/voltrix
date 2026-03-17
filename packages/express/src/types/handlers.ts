/**
 * Middleware types and interfaces for Voltrix
 */

import { WebSocketBehavior } from 'uWebSockets.js';
import { IRequest, IResponse } from './http.js';

// Next Function
export type NextFunction = (error?: Error) => void;
export type Middleware = (eq: IRequest, res: IResponse, next: NextFunction) => void | Promise<any>;

export type HandlerFunction = (
  req: IRequest,
  res: IResponse,
  next?: NextFunction
) => void | Promise<void>;

export type ErrorMiddleware = (
  error: Error,
  req: IRequest,
  res: IResponse,
  next: NextFunction
) => void | Promise<void>;

// Handler Types

export type GlobalErrorHandler = (
  error: Error,
  req: IRequest,
  res: IResponse,
  next: NextFunction
) => void | Promise<void>;

// Middleware Entry
export interface MiddlewareEntry {
  path?: string;
  handler: Middleware;
}

export interface RoutingMethods {
  get(pattern: string, handler: HandlerFunction[]): this;
  post(pattern: string, ...handlers: HandlerFunction[]): this;
  put(pattern: string, ...handlers: HandlerFunction[]): this;
  delete(pattern: string, ...handlers: HandlerFunction[]): this;
  patch(pattern: string, ...handlers: HandlerFunction[]): this;
  options(pattern: string, ...handlers: HandlerFunction[]): this;
  head(pattern: string, ...handlers: HandlerFunction[]): this;
  any(pattern: string, ...handlers: HandlerFunction[]): this;
  ws(pattern: string, behavior: WebSocketBehavior<any>): this;
}

export type TransformerCtx = { schema: any; data: any; type: string; key?: string };
export type TransformerFn = (ctx: TransformerCtx) => any | Promise<any>;
