/**
 * A compiled serializer function — takes a value and returns its serialized string.
 * Produced by a SerializerCompiler at startup; zero schema-lookup cost in hot path.
 */
export type CompiledSerializer = (value: unknown) => string;

/**
 * Pluggable serializer compiler interface.
 *
 * @example
 * ```ts
 * // Using fast-json-stringify
 * import fastJson from 'fast-json-stringify';
 *
 * const compiler: SerializerCompiler = {
 *   compile(schema) {
 *     return fastJson(schema);
 *   }
 * };
 * ```
 */
export interface SerializerCompiler {
  /**
   * Compile a schema into a serializer function.
   * Called once per route at startup — never in the hot path.
   */
  compile(schema: unknown): CompiledSerializer;
}

/**
 * An instantiated serializer bound to a specific route.
 * Includes the compiled function and the original schema for introspection.
 */
export interface RouteSerializer {
  schema: unknown;
  serialize: CompiledSerializer;
}
