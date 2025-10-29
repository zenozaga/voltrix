/**
 * Data generators for mock APIs
 */

import { MockDataGenerator } from './MockDataGenerator.js';

// Create a singleton instance for convenient usage
export const mockData = new MockDataGenerator();

// Export the class for custom instances
export { MockDataGenerator };

// Export types related to data generation
export type {
  DataSchema,
  DataType,
  DataGeneratorFunction,
  MockDataGenerators
} from '../types/index.js';