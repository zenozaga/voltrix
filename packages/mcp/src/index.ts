/**
 * Main Package Index - Tree-shakable exports
 * Compatible with @modelcontextprotocol/sdk
 * Ultra-lightweight MCP implementation with optimal bundle size
 */

// ============================================================================
// Core Types (Tree-shakable, SDK Compatible)
// ============================================================================

export type {
  // JSON-RPC essentials
  JSONRPCRequest,
  JSONRPCResponse,
  JSONRPCError,
  
  // Core MCP types
  ServerInfo,
  Tool,
  Resource,
  Prompt,
  Content,
  TextContent,
  ImageContent,
  PromptMessage,
  
  // Voltrix extensions
  VoltrixTool,
  VoltrixResource,
  VoltrixPrompt,
  VoltrixRichContent
} from './types/protocol.js';

export type {
  VoltrixPlugin,
  PluginContext
} from './types/plugin.js';

// ============================================================================
// Tree-shakable Utilities (SDK Compatible)
// ============================================================================

export {
  ErrorCode,
  isJSONRPCRequest,
  isJSONRPCResponse,
  isTextContent,
} from './types/protocol.js';

// ============================================================================
// Package Metadata
// ============================================================================

export const PACKAGE_INFO = {
  name: '@voltrix/mcp',
  version: '0.1.0',
  description: 'Ultra-lightweight Model Context Protocol implementation compatible with SDK',
  sdkCompatible: true,
  treeshaking: true,
  sideEffects: false,
} as const;