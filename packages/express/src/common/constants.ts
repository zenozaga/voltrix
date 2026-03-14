// ==========================================================
// HTTP METHODS
// ==========================================================
export const HTTP_METHODS = [
  'GET',
  'POST',
  'PUT',
  'DELETE',
  'PATCH',
  'OPTIONS',
  'HEAD',
  'ANY',
] as const;

export type HttpMethod = (typeof HTTP_METHODS)[number];
export type LowerHttpMethod = Lowercase<HttpMethod>;

// ==========================================================
// STATUS TEXT MAP
// ==========================================================
export const STATUS_TEXT = {
  200: 'OK',
  201: 'Created',
  204: 'No Content',

  301: 'Moved Permanently',
  302: 'Found',
  307: 'Temporary Redirect',
  308: 'Permanent Redirect',

  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  422: 'Unprocessable Entity',

  500: 'Internal Server Error',
} as const;

// TS: StatusCode es EXACTAMENTE las llaves posibles
export type StatusCode = keyof typeof STATUS_TEXT;

export const STATUS_LINES: Record<number, string> = Object.fromEntries(
  Object.entries(STATUS_TEXT).map(([code, text]) => [Number(code), `${code} ${text}`])
);

// ==========================================================
// STATUS GROUPS
// ==========================================================
export const REDIRECT_STATUS_CODES: StatusCode[] = [301, 302, 307, 308];
export const SUCCESS_STATUS_CODES: StatusCode[] = [200, 201, 204];
export const CLIENT_ERROR_STATUS_CODES: StatusCode[] = [400, 401, 403, 404, 409, 422];
export const SERVER_ERROR_STATUS_CODES: StatusCode[] = [500];
