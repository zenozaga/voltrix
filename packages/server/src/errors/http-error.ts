/**
 * Base HTTP error. Carries a status code and an optional machine-readable `code`
 * for clients to handle programmatically without parsing the message.
 */
export class HttpError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly expose: boolean;

  constructor(statusCode: number, message: string, code?: string, expose = true) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
    this.code = code ?? `HTTP_${statusCode}`;
    this.expose = expose;

    // Maintain prototype chain across transpilation
    Object.setPrototypeOf(this, new.target.prototype);
  }

  toJSON(): Record<string, unknown> {
    return {
      statusCode: this.statusCode,
      code: this.code,
      message: this.message,
    };
  }
}

// ─── 4xx Factories ───────────────────────────────────────────────────────────

export function badRequest(message = 'Bad Request', code?: string): HttpError {
  return new HttpError(400, message, code ?? 'BAD_REQUEST');
}

export function unauthorized(message = 'Unauthorized', code?: string): HttpError {
  return new HttpError(401, message, code ?? 'UNAUTHORIZED');
}

export function forbidden(message = 'Forbidden', code?: string): HttpError {
  return new HttpError(403, message, code ?? 'FORBIDDEN');
}

export function notFound(message = 'Not Found', code?: string): HttpError {
  return new HttpError(404, message, code ?? 'NOT_FOUND');
}

export function methodNotAllowed(message = 'Method Not Allowed', code?: string): HttpError {
  return new HttpError(405, message, code ?? 'METHOD_NOT_ALLOWED');
}

export function conflict(message = 'Conflict', code?: string): HttpError {
  return new HttpError(409, message, code ?? 'CONFLICT');
}

export function gone(message = 'Gone', code?: string): HttpError {
  return new HttpError(410, message, code ?? 'GONE');
}

export function payloadTooLarge(message = 'Payload Too Large', code?: string): HttpError {
  return new HttpError(413, message, code ?? 'PAYLOAD_TOO_LARGE');
}

export function unsupportedMediaType(message = 'Unsupported Media Type', code?: string): HttpError {
  return new HttpError(415, message, code ?? 'UNSUPPORTED_MEDIA_TYPE');
}

export function unprocessableEntity(message = 'Unprocessable Entity', code?: string): HttpError {
  return new HttpError(422, message, code ?? 'UNPROCESSABLE_ENTITY');
}

export function tooManyRequests(message = 'Too Many Requests', code?: string): HttpError {
  return new HttpError(429, message, code ?? 'TOO_MANY_REQUESTS');
}

// ─── 5xx Factories ───────────────────────────────────────────────────────────

export function internalServerError(message = 'Internal Server Error', code?: string): HttpError {
  return new HttpError(500, message, code ?? 'INTERNAL_SERVER_ERROR', false);
}

export function notImplemented(message = 'Not Implemented', code?: string): HttpError {
  return new HttpError(501, message, code ?? 'NOT_IMPLEMENTED', false);
}

export function badGateway(message = 'Bad Gateway', code?: string): HttpError {
  return new HttpError(502, message, code ?? 'BAD_GATEWAY', false);
}

export function serviceUnavailable(message = 'Service Unavailable', code?: string): HttpError {
  return new HttpError(503, message, code ?? 'SERVICE_UNAVAILABLE', false);
}

/** Returns true if `err` is an `HttpError` instance. */
export function isHttpError(err: unknown): err is HttpError {
  return err instanceof HttpError;
}
