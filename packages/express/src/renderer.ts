import { join, isAbsolute, extname } from 'path';
import { readFileSync, existsSync } from 'fs';

/**
 * Template engine render function
 */
export type RenderFunction = (
  filePath: string,
  data: Record<string, any>,
  content?: string
) => string | Promise<string>;

export type BeforeRenderHook = (
  view: string,
  data: Record<string, any>
) => string | Promise<string> | undefined | null;

export type AfterRenderHook = (
  html: string,
  view: string,
  data: Record<string, any>
) => string | Promise<string>;

export type RenderErrorHandler = (
  err: Error,
  view: string,
  data: Record<string, any>
) => string | Promise<string>;

export interface ViewSettings {
  views?: string;
  layout?: string;
  helpers?: Record<string, (...args: any[]) => any>;
  onError?: RenderErrorHandler;
}

/**
 * Lightweight template rendering engine with:
 * - multi–engine support (.html, .ejs, .hbs…)
 * - template caching
 * - hooks (before/after)
 * - layout system
 * - custom helpers injection
 */
export class Renderer {
  protected viewEngines = new Map<string, RenderFunction>();
  protected viewSettings: Partial<ViewSettings> = {};

  protected beforeRenderHook?: BeforeRenderHook;
  protected afterRenderHook?: AfterRenderHook;

  /** caches */
  private pathCache = new Map<string, string>();
  private templateCache = new Map<string, string>();

  // ------------------------------------------------------
  // ENGINE & SETTINGS
  // ------------------------------------------------------

  viewEngine(ext: string, fn: RenderFunction): this {
    if (!ext.startsWith('.')) ext = '.' + ext;
    this.viewEngines.set(ext, fn);
    return this;
  }

  viewSet<K extends keyof ViewSettings>(key: K, value: ViewSettings[K]): this {
    this.viewSettings[key] = value;
    return this;
  }

  viewGet<K extends keyof ViewSettings>(key: K): ViewSettings[K] | undefined {
    return this.viewSettings[key];
  }

  setLayout(layout: string | undefined): this {
    // store layout path, not file content
    this.viewSettings.layout = layout;
    return this;
  }

  viewBeforeRender(fn: BeforeRenderHook): this {
    this.beforeRenderHook = fn;
    return this;
  }

  viewAfterRender(fn: AfterRenderHook): this {
    this.afterRenderHook = fn;
    return this;
  }

  get viewsDir(): string {
    return this.viewSettings.views ?? process.cwd();
  }

  get layout(): string | undefined {
    return this.viewSettings.layout;
  }

  // ------------------------------------------------------
  // PATH RESOLUTION
  // ------------------------------------------------------

  private resolveViewPath(view: string, defaultExt: string): string {
    const baseDir = this.viewsDir;
    const ext = extname(view) || defaultExt;
    const cacheKey = `${baseDir}:${view}:${ext}`;

    const cached = this.pathCache.get(cacheKey);
    if (cached) return cached;

    const base = isAbsolute(view) ? view : join(baseDir, view);
    let filePath = base.endsWith(ext) ? base : base + ext;

    if (!existsSync(filePath)) {
      const alt = join(base, `index${ext}`);
      if (existsSync(alt)) filePath = alt;
    }

    this.pathCache.set(cacheKey, filePath);
    return filePath;
  }

  // ------------------------------------------------------
  // TEMPLATE LOADING
  // ------------------------------------------------------

  private loadTemplate(filePath: string): string {
    const cached = this.templateCache.get(filePath);
    if (cached) return cached;

    const content = readFileSync(filePath, 'utf8');
    this.templateCache.set(filePath, content);
    return content;
  }

  // ------------------------------------------------------
  // MAIN RENDER PIPELINE
  // ------------------------------------------------------

  async viewRenderFile(
    view: string,
    data: Record<string, any> = {},
    skipLayout = false,
    fallbackExt = '.html'
  ): Promise<string> {
    const safeData = { ...data }; // prevent mutation

    try {
      // Before hook
      if (this.beforeRenderHook) {
        const out = await this.beforeRenderHook(view, safeData);
        if (typeof out === 'string') return out;
      }

      // Resolve file
      const fullPath = this.resolveViewPath(view, fallbackExt);
      const ext = extname(fullPath) || fallbackExt;

      const engine = this.viewEngines.get(ext);
      if (!engine) {
        throw new Error(`No render engine registered for extension "${ext}"`);
      }

      // Inject helpers
      if (this.viewSettings.helpers) {
        safeData.helpers = this.viewSettings.helpers;
      }

      // Render template
      const template = this.loadTemplate(fullPath);
      let html = await engine(fullPath, safeData, template);

      // Layout handling
      if (!skipLayout && this.layout) {
        html = await this.viewRenderFile(
          this.layout,
          { ...safeData, body: html },
          true,
          ext
        );
      }

      // After hook
      if (this.afterRenderHook) {
        html = await this.afterRenderHook(html, view, safeData);
      }

      return html;
    } catch (err: any) {
      const onError = this.viewSettings.onError;
      if (onError) {
        return await onError(err, view, safeData);
      }
      throw err;
    }
  }

  // ------------------------------------------------------
  // CACHE MANAGEMENT
  // ------------------------------------------------------

  clearViewCache(): void {
    this.pathCache.clear();
    this.templateCache.clear();
  }
}
