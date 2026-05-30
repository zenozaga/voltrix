import type { WsSocket, WsMessageContext, WsMiddleware } from '../types/index.js';
export * from './parser.js';

/**
 * 🧅 High-performance Onion-style Message Execution Pipeline.
 * Enables sequential middleware/interceptor execution with full support for asynchronous validation,
 * short-circuiting, payload mutation, and error propagation.
 */
export class WsPipeline<TUser = any> {
  private readonly middlewares: WsMiddleware<TUser>[] = [];

  /**
   * Registers a new middleware/interceptor in the message pipeline.
   */
  use(middleware: WsMiddleware<TUser>): this {
    this.middlewares.push(middleware);
    return this;
  }

  /**
   * Executes the registered middleware pipeline sequentially.
   * If all middlewares successfully call next(), the final handler is executed.
   */
  async run(
    client: WsSocket<TUser>,
    event: string,
    payload: any,
    handler: (client: WsSocket<TUser>, data: any) => void | Promise<void>
  ): Promise<void> {
    const context: WsMessageContext<TUser> = {
      client,
      event,
      payload
    };

    let index = -1;

    const dispatch = async (i: number): Promise<void> => {
      if (i <= index) {
        throw new Error('next() called multiple times inside WsPipeline');
      }
      index = i;

      // When we reach the end of the middleware list, invoke the final message handler
      if (i === this.middlewares.length) {
        await handler(context.client, context.payload);
        return;
      }

      const middleware = this.middlewares[i]!;
      await middleware(context, async () => {
        await dispatch(i + 1);
      });
    };

    await dispatch(0);
  }
}
