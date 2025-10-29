/**
 * Plugin System Types
 * Extensible plugin architecture for Voltrix MCP
 */

// ============================================================================
// Core Plugin Interface
// ============================================================================

export interface VoltrixPlugin {
  /** Plugin metadata */
  id: string;
  name: string;
  version: string;
  description?: string;
  
  /** Plugin capabilities */
  capabilities?: {
    tools?: boolean;
    resources?: boolean;
    prompts?: boolean;
    ui?: boolean;
  };
  
  /** Plugin configuration */
  config?: Record<string, unknown>;
  
  /** Plugin lifecycle hooks */
  initialize?(): Promise<void> | void;
  activate?(): Promise<void> | void;
  deactivate?(): Promise<void> | void;
  cleanup?(): Promise<void> | void;
}

// ============================================================================
// Plugin Context
// ============================================================================

export interface PluginContext {
  /** Plugin information */
  plugin: VoltrixPlugin;
  
  /** Runtime environment */
  environment: 'development' | 'production' | 'test';
  
  /** Shared state */
  state: Map<string, unknown>;
  
  /** Event emitter */
  emit(event: string, data?: unknown): void;
  on(event: string, handler: (data?: unknown) => void): void;
  off(event: string, handler: (data?: unknown) => void): void;
}