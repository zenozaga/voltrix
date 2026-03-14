import { Request } from '../http/request.js';
import { Response } from '../http/response.js';
import { Middleware } from '../types/handlers.js';
import * as path from 'node:path';
import * as fs from 'node:fs';

interface StaticOptions {
  index?: string | string[];
  fallthrough?: boolean;
}

/**
 * High-performance static file middleware for Voltrix
 */
export function staticMiddleware(rootPath: string, options: StaticOptions = {}): Middleware {
  const absoluteRoot = path.resolve(rootPath);
  const indexFiles = Array.isArray(options.index) ? options.index : [options.index || 'index.html'];

  return async (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return next();
    }

    let targetPath = path.join(absoluteRoot, decodeURIComponent(req.url));

    // Security check: prevent directory traversal
    if (!targetPath.startsWith(absoluteRoot)) {
      return next();
    }

    try {
      const stats = await fs.promises.stat(targetPath).catch(() => null);

      if (stats && stats.isDirectory()) {
        // Try index files
        for (const indexFile of indexFiles) {
          const indexPath = path.join(targetPath, indexFile);
          const indexStats = await fs.promises.stat(indexPath).catch(() => null);
          if (indexStats && indexStats.isFile()) {
            await res.sendFile(indexPath);
            return;
          }
        }
      } else if (stats && stats.isFile()) {
        await res.sendFile(targetPath);
        return;
      }
    } catch {
      // Ignored
    }

    if (options.fallthrough !== false) {
      next();
    } else {
      res.status(404).send('Not Found');
    }
  };
}
