import type { SerializerCompiler, CompiledSerializer } from './types.js';

/**
 * Default serializer compiler — uses JSON.stringify.
 * Zero dependencies. Works for any value.
 *
 * Replace at the server level with a schema-based compiler (e.g. fast-json-stringify)
 * for 2–5× throughput improvement on known-shape payloads.
 */
export const defaultSerializerCompiler: SerializerCompiler = {
  compile(_schema: unknown): CompiledSerializer {
    // Schema is intentionally ignored — JSON.stringify handles all shapes.
    // A custom compiler can use the schema to generate a specialized function.
    return (value: unknown): string => JSON.stringify(value) ?? 'null';
  },
};

/** Direct JSON.stringify serializer — used when no schema is registered. */
export const jsonStringify: CompiledSerializer = (value: unknown): string =>
  JSON.stringify(value) ?? 'null';
