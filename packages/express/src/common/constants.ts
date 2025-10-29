export const HTTP_METHODS = [
  'GET',
  'POST',
  'PUT',
  'DELETE',
  'PATCH',
  'OPTIONS',
  'HEAD',
  'ANY',
] as const;

export type HttpMethod =  typeof HTTP_METHODS[number];
export type LowerHttpMethod = Lowercase<HttpMethod>;
