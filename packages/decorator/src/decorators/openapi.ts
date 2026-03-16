import { MetadataRegistry } from '../__internal/metadata-registry.js';

function getOpenApiMetadata(target: any, propertyKey?: string | symbol): any {
  const ctor = typeof target === 'function' ? target : target.constructor;
  const bag = MetadataRegistry.getOrCreate(ctor);
  const key = propertyKey || '@@global';
  
  let customMap = bag.custom.get(key);
  if (!customMap) {
    customMap = new Map();
    bag.custom.set(key, customMap);
  }
  
  let openapi = customMap.get('voltrix:openapi');
  if (!openapi) {
    openapi = {};
    customMap.set('voltrix:openapi', openapi);
  }
  return openapi;
}

function createOpenApiDecorator(updater: (openapi: any, args: any[]) => void) {
  return (...args: any[]) => (target: any, propertyKey?: string | symbol) => {
    const openapi = getOpenApiMetadata(target, propertyKey);
    updater(openapi, args);
  };
}

const ensureArray = (val: any) => {
  if (Array.isArray(val[0])) return val[0];
  return val;
};

// --- Operation Level ---
export const ApiSummary = createOpenApiDecorator((o, [s]) => o.summary = s);
export const ApiDescription = createOpenApiDecorator((o, [d]) => o.description = d);
export const ApiTags = createOpenApiDecorator((o, args) => {
  o.tags = [...(o.tags || []), ...ensureArray(args)];
});
export const ApiId = createOpenApiDecorator((o, [id]) => o.operationId = id);
export const ApiDeprecated = createOpenApiDecorator((o) => o.deprecated = true);
export const ApiExclude = createOpenApiDecorator((o) => o.exclude = true);
export const ApiNamespace = createOpenApiDecorator((o, [n]) => o.namespace = n);
export const ApiSecurity = createOpenApiDecorator((o, [name, ...scopes]) => {
  o.security = o.security || [];
  const sec: any = {};
  sec[name] = ensureArray(scopes);
  o.security.push(sec);
});
export const ApiExtension = createOpenApiDecorator((o, [key, val]) => {
  const k = key.startsWith('x-') ? key : `x-${key}`;
  o[k] = val;
});

// --- Request/Response ---
export const ApiResponse = createOpenApiDecorator((o, [status, options]) => {
  o.responses = o.responses || {};
  o.responses[status] = options;
});
export const ApiRequestBody = createOpenApiDecorator((o, [options]) => o.requestBody = options);

// --- Parameters ---
const addParam = (o: any, param: any) => {
  o.parameters = o.parameters || [];
  o.parameters.push(param);
};

export const ApiParam = createOpenApiDecorator((o, [name, options]) => addParam(o, { name, in: 'path', ...options }));
export const ApiQuery = createOpenApiDecorator((o, [name, options]) => addParam(o, { name, in: 'query', ...options }));
export const ApiHeader = createOpenApiDecorator((o, [name, options]) => addParam(o, { name, in: 'header', ...options }));
export const ApiCookie = createOpenApiDecorator((o, [name, options]) => addParam(o, { name, in: 'cookie', ...options }));

// --- Structural ---
export const ApiSchema = createOpenApiDecorator((o, [options]) => o.schema = options);
export const ApiExternalDoc = createOpenApiDecorator((o, [url, description]) => o.externalDocs = { url, description });

// --- Swagger Namespace ---
export const Swagger = {
  Summary: ApiSummary,
  Description: ApiDescription,
  Tags: ApiTags,
  Id: ApiId,
  Deprecated: ApiDeprecated,
  Exclude: ApiExclude,
  Namespace: ApiNamespace,
  Security: ApiSecurity,
  Extension: ApiExtension,
  Response: ApiResponse,
  Body: ApiRequestBody,
  Param: ApiParam,
  Query: ApiQuery,
  Header: ApiHeader,
  Cookie: ApiCookie,
  Schema: ApiSchema,
  ExternalDoc: ApiExternalDoc,
};
