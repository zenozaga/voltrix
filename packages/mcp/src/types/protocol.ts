/**
 * Core MCP Protocol Types
 * Compatible with @modelcontextprotocol/sdk interfaces and types
 * Ultra-lightweight, tree-shakable interfaces for Model Context Protocol
 */

// ============================================================================
// JSON-RPC 2.0 Base Types (Compatible with SDK)
// ============================================================================

export interface JSONRPCRequest<T = unknown> {
  readonly jsonrpc: '2.0';
  readonly method: string;
  readonly params?: T;
  readonly id?: string | number | null;
}

export interface JSONRPCResponse<T = unknown> {
  readonly jsonrpc: '2.0';
  readonly result?: T;
  readonly error?: JSONRPCError;
  readonly id: string | number | null;
}

export interface JSONRPCError {
  readonly code: number;
  readonly message: string;
  readonly data?: unknown;
}

export interface JSONRPCNotification<T = unknown> {
  readonly jsonrpc: '2.0';
  readonly method: string;
  readonly params?: T;
}

// ============================================================================
// MCP Core Protocol Types (Compatible with SDK)
// ============================================================================

export interface ServerInfo {
  readonly name: string;
  readonly version: string;
}

export interface Implementation {
  readonly name: string;
  readonly version: string;
}

export interface ClientInfo {
  readonly name: string;
  readonly version: string;
}

export interface ServerCapabilities {
  readonly experimental?: Record<string, unknown>;
  readonly logging?: {};
  readonly prompts?: {
    readonly listChanged?: boolean;
  };
  readonly resources?: {
    readonly subscribe?: boolean;
    readonly listChanged?: boolean;
  };
  readonly tools?: {
    readonly listChanged?: boolean;
  };
}

export interface ClientCapabilities {
  readonly experimental?: Record<string, unknown>;
  readonly sampling?: {};
}

// ============================================================================
// MCP Resource Types (Compatible with SDK)
// ============================================================================

export interface Resource {
  readonly uri: string;
  readonly name: string;
  readonly description?: string;
  readonly mimeType?: string;
  readonly annotations?: Annotations;
}

export interface ResourceTemplate {
  readonly uriTemplate: string;
  readonly name: string;
  readonly description?: string;
  readonly mimeType?: string;
  readonly annotations?: Annotations;
}

export interface ResourceContents {
  readonly uri: string;
  readonly mimeType?: string;
  readonly text?: string;
  readonly blob?: string;
}

export interface Annotations {
  readonly audience?: Role[];
  readonly priority?: number;
  readonly [key: string]: unknown;
}

export type Role = 'user' | 'assistant';

// ============================================================================
// MCP Tool Types (Compatible with SDK)
// ============================================================================

export interface Tool {
  readonly name: string;
  readonly description?: string;
  readonly inputSchema: {
    readonly type: 'object';
    readonly properties?: Record<string, unknown>;
    readonly required?: readonly string[];
    readonly additionalProperties?: boolean;
    readonly [key: string]: unknown;
  };
}

export interface ToolCall {
  readonly name: string;
  readonly arguments?: Record<string, unknown>;
}

export interface ToolResult {
  readonly content: Content[];
  readonly isError?: boolean;
}

// ============================================================================
// MCP Prompt Types (Compatible with SDK)
// ============================================================================

export interface Prompt {
  readonly name: string;
  readonly description?: string;
  readonly arguments?: PromptArgument[];
}

export interface PromptArgument {
  readonly name: string;
  readonly description?: string;
  readonly required?: boolean;
}

export interface PromptMessage {
  readonly role: Role;
  readonly content: Content;
}

export interface GetPromptResult {
  readonly description?: string;
  readonly messages: PromptMessage[];
}

// ============================================================================
// MCP Content Types (Compatible with SDK)
// ============================================================================

export interface TextContent {
  readonly type: 'text';
  readonly text: string;
  readonly annotations?: Annotations;
}

export interface ImageContent {
  readonly type: 'image';
  readonly data: string;
  readonly mimeType: string;
  readonly annotations?: Annotations;
}

export interface EmbeddedResource {
  readonly type: 'resource';
  readonly resource: ResourceContents;
  readonly annotations?: Annotations;
}

export type Content = TextContent | ImageContent | EmbeddedResource;

// ============================================================================
// MCP Request/Response Types (Compatible with SDK)
// ============================================================================

export interface InitializeRequest {
  readonly protocolVersion: string;
  readonly capabilities: ClientCapabilities;
  readonly clientInfo: ClientInfo;
}

export interface InitializeResult {
  readonly protocolVersion: string;
  readonly capabilities: ServerCapabilities;
  readonly serverInfo: ServerInfo;
}

export interface ListResourcesRequest {
  readonly cursor?: string;
}

export interface ListResourcesResult {
  readonly resources: Resource[];
  readonly nextCursor?: string;
}

export interface ListResourceTemplatesRequest {
  readonly cursor?: string;
}

export interface ListResourceTemplatesResult {
  readonly resourceTemplates: ResourceTemplate[];
  readonly nextCursor?: string;
}

export interface ReadResourceRequest {
  readonly uri: string;
}

export interface ReadResourceResult {
  readonly contents: ResourceContents[];
}

export interface ListToolsRequest {
  readonly cursor?: string;
}

export interface ListToolsResult {
  readonly tools: Tool[];
  readonly nextCursor?: string;
}

export interface CallToolRequest {
  readonly name: string;
  readonly arguments?: Record<string, unknown>;
}

export interface ListPromptsRequest {
  readonly cursor?: string;
}

export interface ListPromptsResult {
  readonly prompts: Prompt[];
  readonly nextCursor?: string;
}

export interface GetPromptRequest {
  readonly name: string;
  readonly arguments?: Record<string, unknown>;
}

// ============================================================================
// MCP Event Types (Compatible with SDK)
// ============================================================================

export interface ProgressNotification {
  readonly progressToken: string | number;
  readonly progress: number;
  readonly total?: number;
}

export interface LoggingNotification {
  readonly level: LogLevel;
  readonly data: unknown;
  readonly logger?: string;
}

export type LogLevel = 'debug' | 'info' | 'notice' | 'warning' | 'error' | 'critical' | 'alert' | 'emergency';

// ============================================================================
// MCP Error Types (Compatible with SDK)
// ============================================================================

export interface McpError extends JSONRPCError {
  readonly code: ErrorCode;
}

export enum ErrorCode {
  // Standard JSON-RPC errors
  ParseError = -32700,
  InvalidRequest = -32600,
  MethodNotFound = -32601,
  InvalidParams = -32602,
  InternalError = -32603,
  
  // MCP-specific errors
  InvalidProtocolVersion = -32000,
  ResourceNotFound = -32001,
  ToolNotFound = -32002,
  PromptNotFound = -32003,
  ResourceAccessDenied = -32004,
  ToolExecutionError = -32005,
  PromptExecutionError = -32006,
}

// ============================================================================
// Voltrix Extensions (Compatible with SDK structure)
// ============================================================================

/**
 * Extended server info with Voltrix-specific metadata
 */
export interface VoltrixServerInfo extends ServerInfo {
  readonly voltrix?: {
    readonly framework: 'voltrix';
    readonly plugins?: readonly string[];
    readonly features?: readonly string[];
    readonly performance?: {
      readonly startup: number;
      readonly memory: number;
      readonly concurrent: number;
    };
  };
}

/**
 * Extended capabilities with Voltrix features
 */
export interface VoltrixServerCapabilities extends ServerCapabilities {
  readonly voltrix?: {
    readonly version: string;
    readonly decorators?: boolean;
    readonly plugins?: boolean;
    readonly streaming?: boolean;
    readonly middleware?: boolean;
  };
}

/**
 * Enhanced tool with Voltrix metadata
 */
export interface VoltrixTool extends Tool {
  readonly voltrix?: {
    readonly category?: string;
    readonly performance?: {
      readonly timeout?: number;
      readonly retries?: number;
      readonly cache?: boolean;
    };
    readonly ui?: {
      readonly interactive?: boolean;
      readonly streaming?: boolean;
      readonly components?: readonly string[];
    };
  };
}

/**
 * Enhanced resource with Voltrix metadata
 */
export interface VoltrixResource extends Resource {
  readonly voltrix?: {
    readonly cacheable?: boolean;
    readonly streaming?: boolean;
    readonly permissions?: readonly string[];
    readonly compression?: boolean;
  };
}

/**
 * Enhanced prompt with Voltrix metadata
 */
export interface VoltrixPrompt extends Prompt {
  readonly voltrix?: {
    readonly template?: {
      readonly engine?: 'handlebars' | 'mustache' | 'custom';
      readonly variables?: Record<string, unknown>;
    };
    readonly validation?: {
      readonly strict?: boolean;
      readonly sanitize?: boolean;
    };
  };
}

/**
 * Enhanced content with rich UI support
 */
export interface VoltrixRichContent {
  readonly type: 'text' | 'image' | 'resource';
  readonly voltrix?: {
    readonly ui?: {
      readonly type?: 'header' | 'metrics' | 'chart' | 'table' | 'insight' | 'form';
      readonly theme?: 'light' | 'dark' | 'auto' | 'modern';
      readonly interactive?: boolean;
      readonly data?: Record<string, unknown>;
    };
    readonly metadata?: Record<string, unknown>;
  };
  // Base content properties
  readonly text?: string;
  readonly data?: string;
  readonly mimeType?: string;
  readonly resource?: ResourceContents;
  readonly annotations?: Annotations;
}

// ============================================================================
// Utility Types
// ============================================================================

export type McpMethod = 
  | 'initialize'
  | 'resources/list'
  | 'resources/templates/list' 
  | 'resources/read'
  | 'resources/subscribe'
  | 'resources/unsubscribe'
  | 'tools/list'
  | 'tools/call'
  | 'prompts/list'
  | 'prompts/get'
  | 'logging/setLevel';

export type McpNotificationMethod =
  | 'notifications/initialized'
  | 'notifications/progress'
  | 'notifications/message'
  | 'notifications/resources/updated'
  | 'notifications/tools/updated'
  | 'notifications/prompts/updated';

export type VoltrixMethod = 
  | 'voltrix/info'
  | 'voltrix/plugins'
  | 'voltrix/performance'
  | 'voltrix/health';

export type VoltrixNotificationMethod =
  | 'voltrix/plugin/loaded'
  | 'voltrix/plugin/unloaded'
  | 'voltrix/performance/warning'
  | 'voltrix/ui/update';

// ============================================================================
// Type Guards
// ============================================================================

export const isJSONRPCRequest = (obj: unknown): obj is JSONRPCRequest => {
  return typeof obj === 'object' && 
         obj !== null && 
         'jsonrpc' in obj && 
         'method' in obj;
};

export const isJSONRPCResponse = (obj: unknown): obj is JSONRPCResponse => {
  return typeof obj === 'object' && 
         obj !== null && 
         'jsonrpc' in obj && 
         'id' in obj &&
         ('result' in obj || 'error' in obj);
};

export const isJSONRPCNotification = (obj: unknown): obj is JSONRPCNotification => {
  return typeof obj === 'object' && 
         obj !== null && 
         'jsonrpc' in obj && 
         'method' in obj &&
         !('id' in obj);
};

export const isTextContent = (content: Content): content is TextContent => {
  return content.type === 'text';
};

export const isImageContent = (content: Content): content is ImageContent => {
  return content.type === 'image';
};

export const isEmbeddedResource = (content: Content): content is EmbeddedResource => {
  return content.type === 'resource';
};

export const isVoltrixTool = (tool: Tool): tool is VoltrixTool => {
  return 'voltrix' in tool;
};

export const isVoltrixResource = (resource: Resource): resource is VoltrixResource => {
  return 'voltrix' in resource;
};

export const isVoltrixPrompt = (prompt: Prompt): prompt is VoltrixPrompt => {
  return 'voltrix' in prompt;
};