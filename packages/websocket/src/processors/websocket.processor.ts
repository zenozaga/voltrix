import { Metadata } from '@voltrix/core';
import { DIContainer } from '@voltrix/injector';
import { WS_KEYS } from '../decorators/index.js';
import { UwsWebSocketAdapter } from '../adapters/uws-adapter.js';

/**
 * 🚀 Voltrix WebSocket Processor (The Compiler)
 * Discovers gateways, binds dependency injection, and pre-compiles execution pipelines.
 */
export class WebSocketProcessor {
  /**
   * Compiles and registers all decorated WebSocket Gateways within the Voltrix application.
   * Auto-resolves dependencies from the DI Container and attaches to the uWS server instance.
   */
  static process(container: DIContainer, uwsApp?: any, port = 3000): void {
    // 1. Scan the global metadata index for tracked classes
    const classes = Metadata.getTrackedClasses();

    for (const ctor of classes) {
      const meta = Metadata.get(ctor);
      const gatewayOptions = meta[WS_KEYS.GATEWAY];

      // Skip classes that do not declare `@WebSocketGateway()`
      if (!gatewayOptions) continue;

      // 2. Resolve the Gateway instance from the DI Container with full dependency injection
      const gatewayInstance = container.resolve(ctor);
      if (!gatewayInstance) {
        throw new Error(`Failed to resolve WebSocket Gateway: ${ctor.name}`);
      }

      // 3. Configure Handshake Guard if defined
      const path = gatewayOptions.path || '/ws';
      let onUpgradeHook: any = undefined;

      if (gatewayOptions.guard) {
        const guardInstance = container.resolve(gatewayOptions.guard) as any;
        if (!guardInstance) {
          throw new Error(`Failed to resolve WebSocket Guard: ${gatewayOptions.guard.name}`);
        }

        onUpgradeHook = async (req: any, res: any) => {
          let resolvedUser: any = null;
          const context = {
            getRequest: () => req,
            getResponse: () => res,
            setUser: (user: any) => { resolvedUser = user; },
            getUser: () => resolvedUser
          };

          const canActivate = await guardInstance.canActivate(context);
          if (!canActivate) return false;
          return resolvedUser || true;
        };
      }

      // 4. Instantiate Adapter and create the server WebSocket listener
      const adapter = new UwsWebSocketAdapter();
      const server = adapter.create(port, {
        app: uwsApp,
        path,
        onUpgrade: onUpgradeHook
      });

      // 5. Bind Connection events and lifecycles
      const onConnectKey = meta[WS_KEYS.ON_CONNECT];
      const onDisconnectKey = meta[WS_KEYS.ON_DISCONNECT];

      adapter.bindClientConnect(server, async (socket) => {
        // Trigger OnConnect lifecycle hook if declared
        if (onConnectKey) {
          const paramsMeta = Metadata.get(ctor, onConnectKey)[WS_KEYS.PARAMS] || [];
          const args = new Array(paramsMeta.length);
          paramsMeta.forEach((p: any) => {
            if (p.type === 'socket') args[p.index] = socket;
          });
          await (gatewayInstance as any)[onConnectKey](...args);
        }

        // Trigger OnDisconnect lifecycle hook if declared
        if (onDisconnectKey) {
          adapter.bindClientDisconnect(socket, async (client, code, reason) => {
            const paramsMeta = Metadata.get(ctor, onDisconnectKey)[WS_KEYS.PARAMS] || [];
            const args = new Array(paramsMeta.index + 1 || paramsMeta.length);
            paramsMeta.forEach((p: any) => {
              if (p.type === 'socket') args[p.index] = client;
            });
            await (gatewayInstance as any)[onDisconnectKey](...args);
          });
        }
      });

      // 6. Compile and bind message handlers
      const eventsList = meta[WS_KEYS.EVENTS] || [];
      const handlers = eventsList.map((e: any) => {
        const methodKey = e.propertyKey;
        const paramsMeta = Metadata.get(ctor, methodKey)[WS_KEYS.PARAMS] || [];

        return {
          event: e.event,
          handler: async (client: any, data: any) => {
            // Build the arguments array programmatically in O(1)
            const args = new Array(paramsMeta.length);
            paramsMeta.forEach((p: any) => {
              if (p.type === 'socket') args[p.index] = client;
              else if (p.type === 'body') args[p.index] = data;
            });

            await (gatewayInstance as any)[methodKey](...args);
          }
        };
      });

      // Bind all pre-compiled handlers globally on the adapter
      adapter.bindMessageHandlers(server, handlers);
    }
  }
}
