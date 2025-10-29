/**
 * Types index for modular imports
 * Tree-shakable type exports
 */

export type {
  // Core JSON-RPC types
  JSONRPCRequest,
  JSONRPCResponse,
  JSONRPCError,
  
  // MCP protocol types
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
} from './protocol.js';

export type {
  VoltrixPlugin,
  PluginContext
} from './plugin.js';

// Type guards and constants (with runtime)
export {
  isJSONRPCRequest,
  isJSONRPCResponse,
  isTextContent,
  ErrorCode
} from './protocol.js';