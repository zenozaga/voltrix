import { DecoratorFactory } from '../__internal/decorator-factory.js';
import type { IRequest } from '@voltrix/core';

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
      transform: async (req: IRequest) => {
         
         // 📦 Lazy Multipart Parsing
         if (!req.context._filesParsed) {
           req.context.files = {};
           try {
             await (req as any).parseMultipart((part: any) => {
               if (part.filename) {
                  req.context.files![part.name] = part;
               }
             });
             req.context._filesParsed = true;
           } catch (e: any) {
             // Not a multipart request or parsing failed
             req.context._filesParsed = true; 
           }
         }
         
         const file = req.context.files?.[options.name];
         if (options.required && !file) {
            throw new Error(`File "${options.name}" is required.`);
         }
         return file;
      },
      options
    }
  });
}
