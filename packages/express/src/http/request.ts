import type { HttpRequest } from 'uWebSockets.js';
import { IRequest } from '../types/http.js';

export type QueryParser = (queryString: string) => Record<string, any>;
export type ParamsParser = (pattern: string, url: string) => Record<string, string>;

export class Request implements IRequest {
  private cachedQuery?: Record<string, any>;
  private cachedParams?: Record<string, string> | undefined;
  private routePattern?: string;

  public body: any = null;

  constructor(
    private raw: HttpRequest,
    pattern?: string
  ) {
    if (pattern) this.routePattern = pattern;
  }

  pattern(value?: string): string | undefined {
    if (value !== undefined) {
      this.routePattern = value;
      this.cachedParams = undefined;
    }
    return this.routePattern;
  }

  get method(): string {
    return this.raw.getMethod().toUpperCase();
  }

  get url(): string {
    return this.raw.getUrl();
  }

  get query(): Record<string, any> {
    if (!this.cachedQuery) {
      const qs = this.raw.getQuery();
      this.cachedQuery = qs ? Request.queryParser(qs) : {};
    }
    return this.cachedQuery;
  }

  get params(): Record<string, string> {
    if (!this.routePattern) return (this.cachedParams ||= {});
    if (!this.cachedParams) {
      this.cachedParams = Request.paramsParser(this.routePattern, this.url);
    }
    return this.cachedParams;
  }

  getQuery(name: string): any {
    return this.query[name];
  }

  getParam(name: string): string | undefined {
    return this.params[name];
  }

  header(name: string): string {
    return this.raw.getHeader(name);
  }

  headers(): Record<string, string> {
    const result: Record<string, string> = {};
    this.raw.forEach((key, value) => {
      result[key] = value;
    });
    return result;
  }

  //////////////////////////////
  /// Static Parsers
  //////////////////////////////

  static setQueryParser(fn: QueryParser): void {
    Request.queryParser = fn;
  }

  static setParamsParser(fn: ParamsParser): void {
    Request.paramsParser = fn;
  }

  private static queryParser: QueryParser = (qs: string) => {
    if (!qs) return {};
    const out: Record<string, any> = {};
    const pairs = qs.split('&');
    for (let i = 0, len = pairs.length; i < len; i++) {
      const p = pairs[i];
      if (!p) continue;
      const eq = p.indexOf('=');
      const k = decodeURIComponent(eq > 0 ? p.slice(0, eq) : p);
      const v = decodeURIComponent(eq > 0 ? p.slice(eq + 1) : '');
      if (v === 'true') out[k] = true;
      else if (v === 'false') out[k] = false;
      else if (!isNaN(+v) && v.trim() !== '') out[k] = +v;
      else out[k] = v;
    }
    return out;
  };

  private static paramsParser: ParamsParser = (pattern: string, url: string) => {
    const params: Record<string, string> = {};
    if (!pattern || pattern === url) return params;
    const pat = pattern.split('/');
    const seg = url.split('/');
    const len = Math.min(pat.length, seg.length);
    for (let i = 0; i < len; i++) {
      const p = pat[i];
      if (p && p.charCodeAt(0) === 58) {
        // ':'
        params[p.slice(1)] = decodeURIComponent(seg[i] || '');
      }
    }
    return params;
  };
}
