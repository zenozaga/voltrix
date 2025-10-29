/**
 * Core types for Voltrix Mock system
 */

// Mock response body types
export type MockResponseBody = 
  | string 
  | object 
  | Buffer 
  | null
  | (() => any) 
  | ((req: MockRequest) => any);

// Mock request interface (simplified for pattern matching)
export interface MockRequest {
  method: string;
  path: string;
  query?: Record<string, string | string[]>;
  params?: Record<string, string>;
  headers?: Record<string, string>;
  body?: any;
}

// Mock response configuration
export interface MockResponse {
  status?: number;
  headers?: Record<string, string>;
  body?: MockResponseBody;
  delay?: number; // ms delay to simulate network latency
}

// Mock route configuration
export interface MockRoute {
  method: string;
  path: string;
  response: MockResponse | MockResponse[]; // Single response or array for rotating responses
  description?: string;
  tags?: string[];
}

// Mock collection for grouping related routes
export interface MockCollection {
  name: string;
  description?: string;
  baseUrl?: string;
  routes: MockRoute[];
}

// Mock router options
export interface MockRouterOptions {
  delay?: number; // Global delay
  prefix?: string; // Route prefix like "/api/v1"
  cors?: boolean; // Auto CORS headers
  logging?: boolean; // Log mock requests
  fallthrough?: boolean; // Continue to next middleware if no match
}

// Data generation schema for custom generators
export interface DataSchema {
  [key: string]: DataType | DataGeneratorFunction;
}

export type DataType = 
  | 'string' 
  | 'number' 
  | 'boolean' 
  | 'email' 
  | 'name' 
  | 'date' 
  | 'uuid'
  | 'url'
  | 'phone'
  | 'address';

export type DataGeneratorFunction = (index: number) => any;

// Built-in mock data generators interface
export interface MockDataGenerators {
  users: (count?: number) => any[];
  posts: (count?: number) => any[];
  comments: (count?: number) => any[];
  products: (count?: number) => any[];
  orders: (count?: number) => any[];
  companies: (count?: number) => any[];
  custom: (schema: DataSchema, count?: number) => any[];
}

// Mock router interface
export interface MockRouter {
  get(path: string, response: MockResponse | MockResponseBody): MockRouter;
  post(path: string, response: MockResponse | MockResponseBody): MockRouter;
  put(path: string, response: MockResponse | MockResponseBody): MockRouter;
  delete(path: string, response: MockResponse | MockResponseBody): MockRouter;
  patch(path: string, response: MockResponse | MockResponseBody): MockRouter;
  options(path: string, response: MockResponse | MockResponseBody): MockRouter;
  
  route(method: string, path: string, response: MockResponse | MockResponseBody): MockRouter;
  collection(collection: MockCollection): MockRouter;
  
  delay(ms: number): MockRouter;
  cors(enable?: boolean): MockRouter;
  logging(enable?: boolean): MockRouter;
  
  getRoutes(): MockRoute[];
  clear(): MockRouter;
}