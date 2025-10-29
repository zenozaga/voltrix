/**
 * @voltrix/mock - Mock API toolkit for Voltrix
 *
 * A comprehensive mocking solution for creating mock APIs, generating test data,
 * and building prototype applications with Voltrix.
 */

// Export main classes
export { MockRouter, createMockRouter, MockCollections } from './middleware/router.js';
export { mockData, MockDataGenerator } from './generators/index.js';

// Export types
export type {
  MockRoute,
  MockResponse,
  MockResponseBody,
  MockCollection,
  MockRouterOptions,
  MockRequest,
  MockRouter as IMockRouter,
  DataSchema,
  DataType,
  DataGeneratorFunction,
  MockDataGenerators,
} from './types/index.js';

// Quick start utilities
export { createQuickAPI, createRESTAPI, createDemoAPI } from './utils/quick-start.js';
