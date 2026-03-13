export const SYMBOLS = {
  /* ----------------------------------------------------------
   * HTTP (GET, POST, etc.)
   * ---------------------------------------------------------- */
  HTTP_METHOD: Symbol('http:method'),
  HTTP_PATH: Symbol('http:path'),
  HTTP_OPTIONS: Symbol('http:options'),

  /* ----------------------------------------------------------
   * Routes
   * ---------------------------------------------------------- */
  ROUTES: Symbol('routes:list'),

  /* ----------------------------------------------------------
   * Controllers
   * ---------------------------------------------------------- */
  CONTROLLER: Symbol('controller'),

  /* ----------------------------------------------------------
   * Modules
   * ---------------------------------------------------------- */
  MODULE: Symbol('module'),

  /* ----------------------------------------------------------
   * Application bootstrap container
   * ---------------------------------------------------------- */
  APPLICATION: Symbol('application'),

  /* ----------------------------------------------------------
   * Parameters (Body, Query, Param, Header)
   * ---------------------------------------------------------- */
  PARAMETERS: Symbol('parameters:list'),
  BODY: Symbol('parameter:body'),
  PARAM: Symbol('parameter:param'),
  QUERY: Symbol('parameter:query'),
  HEADER: Symbol('parameter:header'),

  /* ----------------------------------------------------------
   * Middleware (per-route / per-controller)
   * ---------------------------------------------------------- */
  MIDDLEWARE: Symbol('middleware'),

  /* ----------------------------------------------------------
   * Security (Roles, Scopes, Auth)
   * ---------------------------------------------------------- */
  ROLES: Symbol('security:roles'),
  SCOPES: Symbol('security:scopes'),
  AUTH: Symbol('security:auth'),

  /* ----------------------------------------------------------
   * Lifecycle hooks
   * ---------------------------------------------------------- */
  LIFECYCLE: Symbol('lifecycle'),
  ON_INIT: Symbol('lifecycle:on_init'),
  ON_DESTROY: Symbol('lifecycle:on_destroy'),
  ON_REQUEST: Symbol('lifecycle:on_request'),
  ON_RESPONSE: Symbol('lifecycle:on_response'),
  ON_ERROR: Symbol('lifecycle:on_error'),

  /* ----------------------------------------------------------
   * Metadata (generic)
   * ---------------------------------------------------------- */
  METADATA: Symbol('metadata'),

  /* ----------------------------------------------------------
   * WebSockets (Gateways)
   * ---------------------------------------------------------- */
  WS_GATEWAY: Symbol('ws:gateway'),
  WS_ON_CONNECT: Symbol('ws:on_connect'),
  WS_ON_MESSAGE: Symbol('ws:on_message'),
  WS_ON_CLOSE: Symbol('ws:on_close'),

  /* ----------------------------------------------------------
   * Observability (input/output/time)
   * ---------------------------------------------------------- */
  OBSERVABLE_CLASS: Symbol('observable:class'),
  OBS_TRACK: Symbol('observable:track'),
  OBS_INPUT: Symbol('observable:input'),
  OBS_OUTPUT: Symbol('observable:output'),
  OBS_TIME: Symbol('observable:time'),
  OBS_IGNORE: Symbol('observable:ignore'),
} as const;

/**
 * 📦 LEGACY SYMBOLS
 * These exist only for backward-compatibility with early versions of Voltrix.
 * They will be removed in a future release.
 */

export const LEGACY = {
  KEY_APP: Symbol('voltrix:type:app'),
  KEY_MODULE: Symbol('voltrix:type:module'),
  KEY_CONTROLLER: Symbol('voltrix:type:controller'),
  KEY_METHOD: Symbol('voltrix:type:method'),
  KEY_PARAMS: Symbol('voltrix:type:params'),
  KEY_ROLES: Symbol('voltrix:type:roles'),
  KEY_SCOPES: Symbol('voltrix:type:scopes'),
  KEY_PUBLIC: Symbol('voltrix:type:public'),
  KEY_PROTECTED: Symbol('voltrix:type:protected'),
  KEY_MIDDLEWARE: Symbol('voltrix:type:middleware'),
  KEY_STORE: Symbol('voltrix:metadata_store'),
  KEY_INTERCEPTORS: Symbol('voltrix:type:interceptors'),
  KEY_LIFECYCLE_HOOKS: Symbol('voltrix:type:lifecycle_hooks'),
  KEY_TYPE_CONTROLLER: 'controller',
  KEY_PARAMS_ROUTE: 'routes',
} as const;
