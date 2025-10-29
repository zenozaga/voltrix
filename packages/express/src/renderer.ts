import { join, isAbsolute, extname } from 'path';
import { readFileSync, existsSync } from 'fs';

export type RenderFunction = (filePath: string, data: Record<string, any>, content?: string) => string | Promise<string>;
export type BeforeRenderHook = (view: string, data: Record<string, any>) => string | Promise<string> | undefined | null;
export type AfterRenderHook = (html: string, view: string, data: Record<string, any>) => string | Promise<string>;
export type RenderErrorHandler = (err: Error, view: string, data: Record<string, any>) => string | Promise<string>;

export interface ViewSettings {
  views?: string;
  layout?: string;
  helpers?: Record<string, (...args: any[]) => any>;
  onError?: RenderErrorHandler;
}

export class Renderer {
  protected viewEngines = new Map<string, RenderFunction>();
  protected viewSettings: Partial<ViewSettings> = {};
  protected beforeRenderHook?: BeforeRenderHook;
  protected afterRenderHook?: AfterRenderHook;

  private pathCache = new Map<string, string>();
  private templateCache = new Map<string, string>();

  // ==========================================
  // REGISTRATION
  // ==========================================

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
    this.templateCache.set('layout', layout || '');
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

  // ==========================================
  // PATH RESOLUTION
  // ==========================================

  private resolveViewPath(view: string, defaultExt: string): string {
    const baseDir = this.viewsDir;
    const ext = extname(view) || defaultExt;
    const key = `${baseDir}:${view}:${ext}`;

    const cached = this.pathCache.get(key);
    if (cached) return cached;

    const base = isAbsolute(view) ? view : join(baseDir, view);
    let filePath = base.endsWith(ext) ? base : base + ext;

    if (!existsSync(filePath)) {
      const alt = join(base, 'index' + ext);
      if (existsSync(alt)) filePath = alt;
    }

    this.pathCache.set(key, filePath);
    return filePath;
  }

  // ==========================================
  // TEMPLATE LOADING
  // ==========================================

  private loadTemplate(filePath: string): string {
    const cached = this.templateCache.get(filePath);
    if (cached) return cached;
    const content = readFileSync(filePath, 'utf8');
    this.templateCache.set(filePath, content);
    return content;
  }

  // ==========================================
  // MAIN RENDER
  // ==========================================

  async viewRenderFile(view: string, data: Record<string, any> = {}, skipLayout = false, currentExt = '.html'): Promise<string> {
    try {
      if (this.beforeRenderHook) {
        const maybe = await this.beforeRenderHook(view, data);
        if (typeof maybe === 'string') return maybe;
      }

      const fullPath = this.resolveViewPath(view, currentExt);
      const ext = extname(fullPath) || currentExt;
      const engine = this.viewEngines.get(ext);
      if (!engine) throw new Error(`No engine registered for "${ext}"`);

      if (this.viewSettings.helpers) data.helpers = this.viewSettings.helpers;

      const content = this.loadTemplate(fullPath);
      let html = await engine(fullPath, data, content);

      if (!skipLayout && this.layout) {
        const layoutData = { ...data, body: html };
        html = await this.viewRenderFile(this.layout, layoutData, true, ext);
      }

      if (this.afterRenderHook) {
        html = await this.afterRenderHook(html, view, data);
      }

      return html;
    } catch (err: any) {
      const onError = this.viewSettings.onError;
      if (onError) return await onError(err, view, data);
      throw err;
    }
  }

  // ==========================================
  // CACHE CONTROL
  // ==========================================

  clearViewCache(): void {
    this.pathCache.clear();
    this.templateCache.clear();
  }
}
