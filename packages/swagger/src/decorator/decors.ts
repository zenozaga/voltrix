import { createOpenApiDecorator, ensureArray, addParam } from './helper';

/**
 * --- OPERATION LEVEL DECORATORS ---
 */

/**
 * Sets a short summary of what the operation does.
 */
export const ApiSummary = createOpenApiDecorator((o, [s]) => o.summary = s);

/**
 * Sets a verbose explanation of the operation behavior.
 */
export const ApiDescription = createOpenApiDecorator((o, [d]) => o.description = d);

/**
 * A list of tags used by the specification for logical grouping by resources or any other qualifier.
 */
export const ApiTags = createOpenApiDecorator((o, args) => {
  o.tags = Array.from(new Set([...(o.tags || []), ...ensureArray(args)]));
});

/**
 * Unique string used to identify the operation. Must be unique among all operations.
 */
export const ApiId = createOpenApiDecorator((o, [id]) => o.operationId = id);

/**
 * Declares this operation to be deprecated.
 */
export const ApiDeprecated = createOpenApiDecorator((o) => o.deprecated = true);

/**
 * Excludes this operation/controller from the generated OpenAPI specification.
 */
export const ApiExclude = createOpenApiDecorator((o) => o.exclude = true);

/**
 * Assigns a namespace to the operation/controller for filtering during generation.
 */
export const ApiNamespace = createOpenApiDecorator((o, [n]) => o.namespace = n);

/**
 * Declares a security requirement for this operation.
 */
export const ApiSecurity = createOpenApiDecorator((o, [name, ...scopes]) => {
  o.security = o.security || [];
  const sec: any = {};
  sec[name] = ensureArray(scopes);
  o.security.push(sec);
});

/**
 * Adds a custom extension property (prefixed with x-) to the operation.
 */
export const ApiExtension = createOpenApiDecorator((o, [key, val]) => {
  const k = key.startsWith('x-') ? key : `x-${key}`;
  o[k] = val;
});

/**
 * --- REQUEST / RESPONSE DECORATORS ---
 */

/**
 * Defines a potential response for this operation.
 */
export const ApiResponse = createOpenApiDecorator((o, [status, options]) => {
  o.responses = o.responses || {};
  o.responses[status] = options;
});

/**
 * Defines the request body content for this operation.
 */
export const ApiRequestBody = createOpenApiDecorator((o, [options]) => o.requestBody = options);

/**
 * --- PARAMETER DECORATORS ---
 */

/**
 * Adds a path parameter.
 */
export const ApiParam = createOpenApiDecorator((o, [name, options]) => addParam(o, { name, in: 'path', ...options }));

/**
 * Adds a query parameter.
 */
export const ApiQuery = createOpenApiDecorator((o, [name, options]) => addParam(o, { name, in: 'query', ...options }));

/**
 * Adds a header parameter.
 */
export const ApiHeader = createOpenApiDecorator((o, [name, options]) => addParam(o, { name, in: 'header', ...options }));

/**
 * Adds a cookie parameter.
 */
export const ApiCookie = createOpenApiDecorator((o, [name, options]) => addParam(o, { name, in: 'cookie', ...options }));

/**
 * --- STRUCTURAL DECORATORS ---
 */

/**
 * Manually defines a schema for the operation.
 */
export const ApiSchema = createOpenApiDecorator((o, [options]) => o.schema = options);

/**
 * Adds external documentation links to the operation.
 */
export const ApiExternalDoc = createOpenApiDecorator((o, [url, description]) => o.externalDocs = { url, description });

/**
 * 📦 Swagger Namespace Group
 * Aggregates all OpenAPI decorators for cleaner usage.
 */
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
