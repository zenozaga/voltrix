import { HttpRequest } from 'uWebSockets.js';
import type { RequestParams, RequestQuery, RequestHeaders } from './types.js';

export class Request {
  public readonly method: string;
  public readonly path: string;
  public readonly url: string;
  public readonly headers: RequestHeaders;
  public readonly query: RequestQuery;
  public readonly params: RequestParams = {};

  // Performance-focused properties
  public readonly ip: string;
  public readonly protocol: string = 'http';

  // Internal properties
  private readonly uwsReq: HttpRequest;

  constructor(uwsReq: HttpRequest, method: string) {
    this.uwsReq = uwsReq;
    this.method = method.toUpperCase();
    this.path = uwsReq.getUrl();

    // Build full URL
    const query = uwsReq.getQuery();
    this.url = this.path + (query ? `?${query}` : '');

    // Parse headers efficiently
    this.headers = this.parseHeaders(uwsReq);

    // Parse query parameters
    this.query = this.parseQuery(query);

    // Get client IP (simplified - in production, handle proxies)
    this.ip = '127.0.0.1'; // uWS doesn't expose IP directly, needs custom implementation
  }

  /**
   * Get header value (case-insensitive, Express-compatible)
   */
  get(headerName: string): string | undefined {
    return this.header(headerName);
  }

  /**
   * Alias for get() - Express compatibility
   */
  header(name: string): string | undefined {
    const lowerName = name.toLowerCase();
    return this.headers[lowerName];
  }

  /**
   * Check if request accepts specific content type
   */
  accepts(type: string): boolean {
    const acceptHeader = this.get('accept');
    if (!acceptHeader) return false;
    return acceptHeader.includes(type) || acceptHeader.includes('*/*');
  }

  /**
   * Get content type
   */
  get contentType(): string | undefined {
    return this.get('content-type');
  }

  /**
   * Check if request is JSON
   */
  get isJson(): boolean {
    const contentType = this.contentType;
    return contentType ? contentType.includes('application/json') : false;
  }

  /**
   * Parse headers efficiently from uWebSockets.js request
   */
  private parseHeaders(uwsReq: HttpRequest): RequestHeaders {
    const headers: RequestHeaders = {};

    // uWS forEach is more efficient than manual iteration
    uwsReq.forEach((key: string, value: string) => {
      headers[key.toLowerCase()] = value;
    });

    return headers;
  }

  /**
   * Parse query parameters efficiently
   */
  private parseQuery(queryString: string): RequestQuery {
    if (!queryString) return {};

    const query: RequestQuery = {};
    const pairs = queryString.split('&');

    for (let i = 0; i < pairs.length; i++) {
      const pair = pairs[i];
      if (!pair) continue;
      
      const equalIndex = pair.indexOf('=');

      if (equalIndex === -1) {
        // Key without value
        const key = this.decodeURIComponentSafe(pair);
        if (key) query[key] = '';
      } else {
        // Key-value pair
        const key = this.decodeURIComponentSafe(pair.slice(0, equalIndex));
        const value = this.decodeURIComponentSafe(pair.slice(equalIndex + 1));

        if (key) {
          // Handle multiple values for same key (convert to array)
          const existing = query[key];
          if (existing === undefined) {
            query[key] = value;
          } else if (Array.isArray(existing)) {
            existing.push(value);
          } else {
            query[key] = [existing, value];
          }
        }
      }
    }

    return query;
  }

  /**
   * Safe URL decoding that doesn't throw on invalid input
   */
  private decodeURIComponentSafe(str: string): string {
    try {
      return decodeURIComponent(str);
    } catch {
      return str; // Return original string if decoding fails
    }
  }
}