import { OpenAPIDoc, OpenAPIOperation, SwaggerOptions, OpenApiMetadata, OpenAPIParameter, OpenAPIPath } from './types';
import { normalizePath, extractPathParams } from './utils';
import { inferResponse } from './inference';

/**
 * Shared logic for building a Swagger specification
 */
export class SpecBuilder {
  static createBase(options: SwaggerOptions): OpenAPIDoc {
    return {
      openapi: '3.0.0',
      info: {
        title: options.title || 'OpenAPI Specification',
        version: options.version || '1.0.0',
        description: options.description || '',
      },
      servers: options.servers || [],
      paths: {},
      components: {
        schemas: {},
        securitySchemes: {},
      },
    };
  }

  static addPath(spec: OpenAPIDoc, path: string, method: string, meta: OpenApiMetadata): void {
    const normalizedPath = normalizePath(path);
    const m = method.toLowerCase() as keyof OpenAPIPath;

    if (!spec.paths[normalizedPath]) {
      spec.paths[normalizedPath] = {} as OpenAPIPath;
    }

    const pathItem = spec.paths[normalizedPath];

    const operation: OpenAPIOperation = {
      summary: meta.summary,
      description: meta.description,
      operationId: meta.operationId,
      tags: meta.tags || [],
      deprecated: meta.deprecated,
      security: meta.security,
      parameters: meta.parameters || [],
      requestBody: meta.requestBody,
      responses: meta.responses || {},
    };

    // --- Automatic Response Inference ---
    inferResponse(operation, meta);

    // --- Path Parameter Extraction ---
    const pathParams = extractPathParams(normalizedPath);
    const parameters = operation.parameters || (operation.parameters = []);

    for (const p of pathParams) {
      if (!parameters.some((idx: OpenAPIParameter) => idx.name === p && idx.in === 'path')) {
        parameters.push({
          name: p,
          in: 'path',
          required: true,
          schema: { type: 'string' }
        });
      }
    }

    // Merge extensions
    for (const key of Object.keys(meta)) {
      if (key.startsWith('x-')) {
        (operation as any)[key] = (meta as any)[key];
      }
    }

    (pathItem as any)[m] = operation;
  }
}
