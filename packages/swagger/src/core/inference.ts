import 'reflect-metadata';
import { OpenAPIOperation, OpenApiMetadata } from './types';

/**
 * Infers the response for an operation based on available metadata
 */
export function inferResponse(operation: OpenAPIOperation, meta: OpenApiMetadata): void {
  // Only infer if no responses are explicitly defined
  if (Object.keys(operation.responses).length > 0) return;

  if (meta.inferredResponse) {
    const returnType = meta.inferredResponse;
    const typeName = returnType.name;
    
    console.log(`DEBUG: Inferred type name: ${typeName}`);

    // Simple Promise unwrapping (cannot get generic type easily)
    if (typeName === 'Promise') {
      operation.responses['200'] = { description: 'OK (Async)' };
    } else {
      const typeMap: Record<string, { type: string; format?: string; items?: any }> = {
        'String': { type: 'string' },
        'Number': { type: 'number' },
        'Boolean': { type: 'boolean' },
        'Object': { type: 'object' },
        'Array': { type: 'array', items: { type: 'object' } },
        'Date': { type: 'string', format: 'date-time' },
      };
      
      const schema = typeMap[typeName] || { $ref: `#/components/schemas/${typeName}` };
      
      operation.responses['200'] = {
        description: 'Automatic response inference',
        content: {
          'application/json': { schema: schema as any } // Cast to any for the $ref vs OpenAPISchema union
        }
      };
    }
  } else {
    operation.responses['200'] = { description: 'OK' };
  }
}
