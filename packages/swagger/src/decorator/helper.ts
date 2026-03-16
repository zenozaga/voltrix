import { SwaggerMeta } from './constants';

/**
 * Creates an OpenAPI decorator that updates the operation metadata.
 * Supports both Legacy (Experimental) and Standard (Stage 3) decorators.
 */
export function createOpenApiDecorator(updater: (openapi: any, args: any[]) => void) {
  return (...args: any[]) => (target: any, propertyKeyOrContext?: string | symbol | any, _descriptor?: any) => {
    // Handle Legacy Decorators (Experimental)
    if (typeof propertyKeyOrContext === 'string' || typeof propertyKeyOrContext === 'symbol' || propertyKeyOrContext === undefined) {
      const data = SwaggerMeta.get(target, propertyKeyOrContext);
      updater(data, args);
      return;
    }
    
    // Handle Standard Decorators (Stage 3) - propertyKeyOrContext is the Context object
    const context = propertyKeyOrContext;
    if (context.kind === 'class') {
      const data = SwaggerMeta.get(target);
      updater(data, args);
    } else if (context.kind === 'method') {
      const data = SwaggerMeta.get(target, context.name);
      updater(data, args);
    }
  };
}

/**
 * Ensures that the value is an array.
 */
export const ensureArray = (val: any) => {
  if (Array.isArray(val[0])) return val[0];
  return val;
};

/**
 * Internal helper to add a parameter to the operation.
 */
export const addParam = (o: any, param: any) => {
  o.parameters = o.parameters || [];
  o.parameters.push(param);
};