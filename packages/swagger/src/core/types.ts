export type OpenAPIProperty = OpenAPISchema;

export interface OpenAPISchema {
  type?: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';
  items?: OpenAPISchema;
  properties?: Record<string, OpenAPISchema>;
  required?: string[];
  $ref?: string;
  format?: string;
  enum?: unknown[];
  description?: string;
  example?: unknown;
  default?: unknown;
  [key: `x-${string}`]: unknown;
}

export interface OpenAPIParameter {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  description?: string;
  required?: boolean;
  deprecated?: boolean;
  schema?: OpenAPISchema;
  example?: unknown;
  examples?: Record<string, unknown>;
}

export interface OpenAPIResponse {
  description: string;
  content?: Record<string, {
    schema: OpenAPISchema;
    example?: unknown;
    examples?: Record<string, unknown>;
  }>;
  headers?: Record<string, {
    description?: string;
    schema: OpenAPISchema;
  }>;
}

export interface OpenAPIOperation {
  summary?: string;
  description?: string;
  operationId?: string;
  tags?: string[];
  parameters?: OpenAPIParameter[];
  requestBody?: {
    description?: string;
    required?: boolean;
    content: Record<string, {
      schema: OpenAPISchema;
    }>;
  };
  responses: Record<string, OpenAPIResponse>;
  deprecated?: boolean;
  security?: Record<string, string[]>[];
  [key: `x-${string}`]: unknown;
}

export interface OpenAPIPath {
  get?: OpenAPIOperation;
  post?: OpenAPIOperation;
  put?: OpenAPIOperation;
  delete?: OpenAPIOperation;
  patch?: OpenAPIOperation;
  options?: OpenAPIOperation;
  head?: OpenAPIOperation;
  trace?: OpenAPIOperation;
  [key: `x-${string}`]: unknown;
}

export interface OpenAPIDoc {
  openapi: '3.0.0';
  info: {
    title: string;
    version: string;
    description?: string;
  };
  servers?: { url: string; description?: string }[];
  paths: Record<string, OpenAPIPath>;
  components?: {
    schemas?: Record<string, OpenAPISchema>;
    securitySchemes?: Record<string, {
      type: 'apiKey' | 'http' | 'oauth2' | 'openIdConnect';
      description?: string;
      name?: string;
      in?: 'header' | 'query' | 'cookie';
      scheme?: string;
      bearerFormat?: string;
      flows?: unknown;
      openIdConnectUrl?: string;
    }>;
  };
}

export interface SwaggerOptions {
  title?: string;
  version?: string;
  description?: string;
  namespace?: string;
  servers?: { url: string; description?: string }[];
}

/**
 * Metadata stored in Voltrix Tree / Router
 */
export interface OpenApiMetadata extends OpenAPIOperation {
  exclude?: boolean;
  namespace?: string;
  inferredResponse?: { name: string };
}
