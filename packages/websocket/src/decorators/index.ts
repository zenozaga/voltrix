import { Metadata } from '@voltrix/core';
import { Injectable } from '@voltrix/injector';

/**
 * 🏷️ Global Symbols and Keys for WebSocket metadata storage
 */
export const WS_KEYS = {
  GATEWAY: 'voltrix:ws:gateway',
  EVENTS: 'voltrix:ws:events',
  PARAMS: 'voltrix:ws:params',
  ON_CONNECT: 'voltrix:ws:on_connect',
  ON_DISCONNECT: 'voltrix:ws:on_disconnect'
} as const;

/**
 * 🚀 WebSocketGateway Decorator.
 * Declares a class as an injectable WebSocket Gateway.
 */
export function WebSocketGateway(options: { path?: string; guard?: any } = {}): ClassDecorator {
  return (target: any) => {
    const meta = Metadata.get(target);
    meta[WS_KEYS.GATEWAY] = options;

    // Programmatically apply the DI @Injectable() decorator to register within the DI Container
    Injectable()(target);
  };
}

/**
 * 📡 SubscribeMessage Decorator.
 * Binds a gateway method to intercept incoming client messages matching the specified event.
 */
export function SubscribeMessage(event: string): MethodDecorator {
  return (target: any, propertyKey: string | symbol) => {
    const ctor = target.constructor;
    const meta = Metadata.get(ctor);
    const events = meta[WS_KEYS.EVENTS] || [];
    events.push({ event, propertyKey });
    meta[WS_KEYS.EVENTS] = events;
  };
}

/**
 * 🔌 OnConnect Decorator.
 * Binds a gateway method to connection established events.
 */
export function OnConnect(): MethodDecorator {
  return (target: any, propertyKey: string | symbol) => {
    const ctor = target.constructor;
    const meta = Metadata.get(ctor);
    meta[WS_KEYS.ON_CONNECT] = propertyKey;
  };
}

/**
 * 🔌 OnDisconnect Decorator.
 * Binds a gateway method to connection closed events.
 */
export function OnDisconnect(): MethodDecorator {
  return (target: any, propertyKey: string | symbol) => {
    const ctor = target.constructor;
    const meta = Metadata.get(ctor);
    meta[WS_KEYS.ON_DISCONNECT] = propertyKey;
  };
}

/**
 * 🎛️ ConnectedSocket Parameter Decorator.
 * Injects the normalized WsSocket wrapper into the decorated parameter.
 */
export function ConnectedSocket(): ParameterDecorator {
  return (target: any, propertyKey: string | symbol | undefined, parameterIndex: number) => {
    if (!propertyKey) return;
    const ctor = target.constructor;
    const meta = Metadata.get(ctor, propertyKey);
    const params = meta[WS_KEYS.PARAMS] || [];
    params.push({ index: parameterIndex, type: 'socket' });
    meta[WS_KEYS.PARAMS] = params;
  };
}

/**
 * 📦 MessageBody Parameter Decorator.
 * Injects the parsed packet data payload into the decorated parameter.
 */
export function MessageBody(): ParameterDecorator {
  return (target: any, propertyKey: string | symbol | undefined, parameterIndex: number) => {
    if (!propertyKey) return;
    const ctor = target.constructor;
    const meta = Metadata.get(ctor, propertyKey);
    const params = meta[WS_KEYS.PARAMS] || [];
    params.push({ index: parameterIndex, type: 'body' });
    meta[WS_KEYS.PARAMS] = params;
  };
}
