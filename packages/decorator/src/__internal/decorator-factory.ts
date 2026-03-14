import { META } from '@voltrix/injector';
import { MetadataRegistry, Constructor } from './metadata-registry.js';

/**
 * Decorator types for categorization
 */
export type DecoratorType = 
  | 'application' 
  | 'module' 
  | 'controller' 
  | 'route' 
  | 'parameter' 
  | 'middleware' 
  | 'custom';

export interface DecoratorConfig {
  type: DecoratorType;
  key?: string | symbol;
  value?: any;
}

/**
 * 🛠️ Decorator Factory
 * Standardizes how all decorators (Core & Third-party) register metadata.
 */
export const DecoratorFactory = {
  /**
   * Create a standard decorator
   */
  create(config: DecoratorConfig) {
    return (target: any, propertyKey?: string | symbol, parameterIndexOrDescriptor?: any) => {
      // 🧊 Normalize target to Constructor
      const isClass = typeof target === 'function';
      const ctor: Constructor = isClass ? target : target.constructor;

      // 🎒 Get or create the pre-computed Metadata Bag
      const bag = MetadataRegistry.getOrCreate(ctor);

      // ⚡ Logical registration based on type
      switch (config.type) {
        case 'application':
        case 'module':
        case 'controller':
          bag.type = config.type;
          bag.options = { ...bag.options, ...config.value };
          
          // 💉 Automatically mark as Injectable for the DI Container
          // This ensures constructor dependencies are discoverable
          Reflect.defineMetadata(META.INJECTABLE, true, ctor);
          break;

        case 'route':
          if (!propertyKey) throw new Error('@Route must be applied to a method.');
          bag.routes.set(propertyKey, { 
            propertyKey,
            ...config.value 
          });
          break;

        case 'parameter':
          if (!propertyKey) throw new Error('@Parameter must be applied to a method parameter.');
          const params = bag.parameters.get(propertyKey) || [];
          params.push({ 
            index: parameterIndexOrDescriptor, 
            ...config.value 
          });
          // Keep parameters sorted by index for O(1) resolving later
          bag.parameters.set(propertyKey, params.sort((a, b) => a.index - b.index));
          break;

        case 'middleware':
          const key = propertyKey || '@@global';
          const list = bag.middlewares.get(key) || [];
          list.push(config.value);
          bag.middlewares.set(key, list);
          break;

        case 'custom':
          if (!config.key) throw new Error('Custom decorators must provide a unique key.');
          const customKey = propertyKey || '@@global';
          const customMap = bag.custom.get(customKey) || new Map();
          customMap.set(config.key, config.value);
          bag.custom.set(customKey, customMap);
          break;
      }
    };
  }
};
