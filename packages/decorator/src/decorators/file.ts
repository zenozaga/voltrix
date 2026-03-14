import { DecoratorFactory } from '../__internal/decorator-factory.js';

/**
 * 🚀 File Decorator
 */

export interface FileOptions {
  name: string;
  required?: boolean;
  maxSize?: number;
}

/**
 * Marks a parameter for file injection.
 * Usage:
 * saveData(@File('avatar') file: any)
 */
export function File(optionsOrName: string | FileOptions) {
  const options = typeof optionsOrName === 'string'
    ? { name: optionsOrName }
    : optionsOrName;

  return DecoratorFactory.create({
    type: 'parameter',
    value: {
      type: 'custom',
      name: 'file',
      transform: async (req: any) => {
         // Mock multipart parsing or just return from req.files
         return (req as any).files?.[options.name];
      },
      options
    }
  });
}
