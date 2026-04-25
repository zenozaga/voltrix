/** Standard HTTP status text by code. */
export const STATUS_TEXT: Record<number, string> = {
  100: 'Continue',
  101: 'Switching Protocols',
  200: 'OK',
  201: 'Created',
  202: 'Accepted',
  204: 'No Content',
  206: 'Partial Content',
  301: 'Moved Permanently',
  302: 'Found',
  304: 'Not Modified',
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  408: 'Request Timeout',
  409: 'Conflict',
  410: 'Gone',
  413: 'Payload Too Large',
  415: 'Unsupported Media Type',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  501: 'Not Implemented',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
};

/**
 * Pre-built status line strings — avoids string concatenation in hot path.
 * Format: "<code> <text>"
 */
export const STATUS_LINES: Record<number, string> = Object.fromEntries(
  Object.entries(STATUS_TEXT).map(([code, text]) => [code, `${code} ${text}`])
);

/** Common MIME types keyed by file extension (lowercase, including dot). */
export const MIME_TYPES: Record<string, string> = {
  '.html':  'text/html; charset=utf-8',
  '.htm':   'text/html; charset=utf-8',
  '.txt':   'text/plain; charset=utf-8',
  '.json':  'application/json; charset=utf-8',
  '.js':    'text/javascript; charset=utf-8',
  '.mjs':   'text/javascript; charset=utf-8',
  '.css':   'text/css; charset=utf-8',
  '.xml':   'application/xml; charset=utf-8',
  '.csv':   'text/csv; charset=utf-8',
  '.png':   'image/png',
  '.jpg':   'image/jpeg',
  '.jpeg':  'image/jpeg',
  '.gif':   'image/gif',
  '.svg':   'image/svg+xml',
  '.ico':   'image/x-icon',
  '.webp':  'image/webp',
  '.avif':  'image/avif',
  '.mp4':   'video/mp4',
  '.webm':  'video/webm',
  '.mp3':   'audio/mpeg',
  '.wav':   'audio/wav',
  '.ogg':   'audio/ogg',
  '.woff':  'font/woff',
  '.woff2': 'font/woff2',
  '.ttf':   'font/ttf',
  '.otf':   'font/otf',
  '.wasm':  'application/wasm',
  '.pdf':   'application/pdf',
  '.zip':   'application/zip',
  '.gz':    'application/gzip',
};

/** Content-Type values used in the hot path — pre-built strings. */
export const CONTENT_TYPES = {
  JSON:       'application/json; charset=utf-8',
  TEXT:       'text/plain; charset=utf-8',
  HTML:       'text/html; charset=utf-8',
  BINARY:     'application/octet-stream',
  FORM:       'application/x-www-form-urlencoded',
  MULTIPART:  'multipart/form-data',
} as const;

/** HTTP methods as uppercase strings. */
export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS', 'ANY'] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];
