// ─── Server ───────────────────────────────────────────────────────────────────
export { VoltrixServer, createServer } from './server.js';
export type { VoltrixServerOptions, ListenOptions } from './server.js';

// ─── Context ──────────────────────────────────────────────────────────────────
export { Ctx } from './context/context.js';
export { CtxPool } from './context/pool.js';

// ─── Router ───────────────────────────────────────────────────────────────────
export { Router, createRouter } from './router/router.js';
export { RouteBuilder } from './router/route-builder.js';
export { RouteRegistry } from './router/route-registry.js';
export type { RouteTreeEntry } from './router/route-registry.js';
export type {
  RouteDefinition,
  RouteHandler,
  RouteMeta,
  CompiledRoute,
  RouteMatch,
} from './router/route-definition.js';

// ─── Hooks ────────────────────────────────────────────────────────────────────
export type {
  HookSet,
  OnRequestHook,
  PreHandlerHook,
  OnSendHook,
  OnResponseHook,
  OnErrorHook,
} from './hooks/hook-types.js';
export { HookClass, emptyHookSet } from './hooks/hook-types.js';
export { compilePipeline } from './hooks/pipeline-runner.js';
export type { CompiledPipeline } from './hooks/pipeline-runner.js';

// ─── Plugins ──────────────────────────────────────────────────────────────────
export type { VoltrixPlugin, PluginApi } from './plugins/plugin-types.js';

// ─── Serializers ─────────────────────────────────────────────────────────────
export type { SerializerCompiler, CompiledSerializer, RouteSerializer } from './serializers/types.js';
export { defaultSerializerCompiler, jsonStringify } from './serializers/default.js';
export { JsonWriter } from './serializers/json-writer.js';

// ─── Validators ───────────────────────────────────────────────────────────────
export type {
  ValidatorCompiler,
  CompiledValidator,
  RouteValidators,
  RouteSchemas,
} from './validators/types.js';

// ─── Errors ───────────────────────────────────────────────────────────────────
export { HttpError, isHttpError } from './errors/http-error.js';
export {
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  methodNotAllowed,
  conflict,
  gone,
  payloadTooLarge,
  unsupportedMediaType,
  unprocessableEntity,
  tooManyRequests,
  internalServerError,
  notImplemented,
  badGateway,
  serviceUnavailable,
} from './errors/http-error.js';

// ─── Common ───────────────────────────────────────────────────────────────────
export { STATUS_TEXT, STATUS_LINES, MIME_TYPES, CONTENT_TYPES, HTTP_METHODS } from './common/constants.js';
export type { HttpMethod } from './common/constants.js';
export type { BodyInput } from './common/normalize.js';
export { parseQueryString, normalizeBody, concatChunks } from './common/normalize.js';
