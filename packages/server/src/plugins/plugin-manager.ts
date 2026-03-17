import type { VoltrixPlugin, PluginApi } from './plugin-types.js';
import type { HookSet } from '../hooks/hook-types.js';
import type { SerializerCompiler } from '../serializers/types.js';
import type { ValidatorCompiler } from '../validators/types.js';
import type { CtxPool } from '../context/pool.js';
import { Ctx } from '../context/context.js';

/**
 * Manages plugin registration and Ctx decoration at startup.
 * Must be fully initialized before the server starts listening.
 */
export class PluginManager {
  /** Keys added via decorateCtx — checked for conflicts. */
  private readonly decoratedKeys = new Set<string>();

  constructor(
    private readonly hooks: HookSet,
    private readonly serializerRef: { value: SerializerCompiler },
    private readonly validatorRef:  { value: ValidatorCompiler | undefined },
    private readonly pool: CtxPool,
  ) {}

  /** Register a plugin with its options. Awaits async register() calls. */
  async register<TOptions>(plugin: VoltrixPlugin<TOptions>, opts: TOptions): Promise<void> {
    const api = this.buildApi();
    await plugin.register(api, opts);
  }

  // ─── Internal ──────────────────────────────────────────────────────────────

  private buildApi(): PluginApi {
    return {
      decorateCtx: (key: string, defaultValue: unknown): void => {
        if (this.decoratedKeys.has(key)) {
          throw new Error(
            `[voltrix/server] decorateCtx: key "${key}" is already registered. ` +
            `Two plugins cannot decorate the same Ctx property.`
          );
        }
        this.decoratedKeys.add(key);
        // Add to prototype — O(1) property access on every request, zero alloc
        (Ctx.prototype as unknown as Record<string, unknown>)[key] = defaultValue;
        // Register the default for reset on every pool acquire — prevents state bleed
        this.pool.addDecoratedReset(key, defaultValue);
      },

      addHook: <K extends keyof HookSet>(name: K, hook: HookSet[K][number]): void => {
        (this.hooks[name] as unknown[]).push(hook);
      },

      setSerializerCompiler: (compiler: SerializerCompiler): void => {
        this.serializerRef.value = compiler;
      },

      setValidatorCompiler: (compiler: ValidatorCompiler): void => {
        this.validatorRef.value = compiler;
      },
    };
  }
}
