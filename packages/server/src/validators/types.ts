/**
 * A compiled validator function.
 * Returns `true` if the value is valid, throws or returns `false` otherwise.
 * Throwing is preferred — include a descriptive message.
 */
export type CompiledValidator = (value: unknown) => boolean;

/**
 * Pluggable validator compiler interface.
 *
 * @example
 * ```ts
 * // Using Zod
 * import { z } from 'zod';
 *
 * const compiler: ValidatorCompiler = {
 *   compile(schema: z.ZodTypeAny) {
 *     return (value: unknown) => {
 *       schema.parse(value); // throws ZodError on failure
 *       return true;
 *     };
 *   }
 * };
 * ```
 *
 * @example
 * ```ts
 * // Using AJV
 * import Ajv from 'ajv';
 * const ajv = new Ajv();
 *
 * const compiler: ValidatorCompiler = {
 *   compile(schema) {
 *     const validate = ajv.compile(schema);
 *     return (value) => {
 *       if (!validate(value)) throw new Error(ajv.errorsText(validate.errors));
 *       return true;
 *     };
 *   }
 * };
 * ```
 */
export interface ValidatorCompiler {
  /**
   * Compile a schema into a validator function.
   * Called once per route at startup — never in the hot path.
   */
  compile(schema: unknown): CompiledValidator;
}

/**
 * Route-level validators — each targets a specific part of the request.
 * All fields are optional; only compile the parts that have schemas.
 */
export interface RouteValidators {
  /** Validate the parsed request body. */
  body?: CompiledValidator;
  /** Validate the parsed query string. */
  query?: CompiledValidator;
  /** Validate the matched route parameters. */
  params?: CompiledValidator;
  /** Validate the request headers. */
  headers?: CompiledValidator;
}

/**
 * Schema definitions provided by the route author before compilation.
 * Passed to the ValidatorCompiler to produce RouteValidators.
 */
export interface RouteSchemas {
  body?: unknown;
  query?: unknown;
  params?: unknown;
  headers?: unknown;
}
