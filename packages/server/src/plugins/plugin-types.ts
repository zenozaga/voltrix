import type { HookSet } from '../hooks/hook-types.js';
import type { SerializerCompiler } from '../serializers/types.js';
import type { ValidatorCompiler } from '../validators/types.js';

/**
 * The plugin registration API — passed to `plugin.register()` at startup.
 * Plugins interact with the server only through this interface.
 */
export interface PluginApi {
  /**
   * Add a default value for a property on every Ctx instance.
   * Called at startup — zero cost per request.
   *
   * If the key already exists (from another plugin or core), throws to prevent
   * silent overwrites.
   *
   * @example
   * ```ts
   * api.decorateCtx('db', null);
   * // Now every ctx has ctx.db — populate it in an onRequest hook
   * api.addHook('onRequest', async (ctx) => { ctx.db = await pool.acquire(); });
   * ```
   */
  decorateCtx(key: string, defaultValue: unknown): void;

  /** Register a global lifecycle hook. Runs for every request. */
  addHook<K extends keyof HookSet>(name: K, hook: HookSet[K][number]): void;

  /** Replace the global serializer compiler. Must be called before listen(). */
  setSerializerCompiler(compiler: SerializerCompiler): void;

  /** Replace the global validator compiler. Must be called before listen(). */
  setValidatorCompiler(compiler: ValidatorCompiler): void;
}

/**
 * A Voltrix plugin — a named unit of startup-time work.
 *
 * @example
 * ```ts
 * const authPlugin: VoltrixPlugin = {
 *   name: 'auth',
 *   version: '1.0.0',
 *   register(api, opts: { secret: string }) {
 *     api.decorateCtx('user', null);
 *     api.addHook('onRequest', async (ctx) => {
 *       ctx.user = await verifyToken(ctx.header('authorization'), opts.secret);
 *     });
 *   }
 * };
 * ```
 */
export interface VoltrixPlugin<TOptions = unknown> {
  name: string;
  version?: string;
  register(api: PluginApi, opts: TOptions): void | Promise<void>;
}
