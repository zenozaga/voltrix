# @voltrix/mcp Package Knowledge Base

## Overview

The `@voltrix/mcp` package provides a decorator-based implementation of the Model Context Protocol (MCP) for the Voltrix framework. This package enables developers to create MCP servers using familiar TypeScript decorators, integrating seamlessly with the Voltrix ecosystem.

## What is MCP (Model Context Protocol)?

The Model Context Protocol is an open standard that enables AI applications to securely connect with data sources. It provides a standardized way for AI models to access external data while maintaining security boundaries and user control.

### Key MCP Concepts

1. **Resources** - Data sources that can be read by AI models
2. **Tools** - Functions that AI models can call to perform actions  
3. **Prompts** - Reusable prompt templates with parameters
4. **Sampling** - Ability to request AI model completions

### MCP Protocol Specification

#### Transport Layer Support
- **JSON-RPC 2.0** - Base communication protocol for all MCP operations
- **WebSocket** - Real-time bidirectional communication with heartbeat support
- **HTTP/HTTPS** - RESTful resource access with CORS support
- **stdin/stdout** - Process-based communication for CLI tools

#### Message Format Standards
```typescript
// Standard MCP Request
interface McpRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: Record<string, any>;
}

// Standard MCP Response  
interface McpResponse {
  jsonrpc: "2.0";
  id: string | number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

// MCP Error Codes (RFC compliant)
enum McpErrorCodes {
  ParseError = -32700,
  InvalidRequest = -32600,
  MethodNotFound = -32601,
  InvalidParams = -32602,
  InternalError = -32603,
  ResourceNotFound = -32001,
  ResourceUnavailable = -32002,
  ToolExecutionError = -32003
}
```

#### Authentication & Security
```typescript
interface McpAuthConfig {
  type: 'none' | 'bearer' | 'apikey' | 'oauth2' | 'custom';
  required: boolean;
  
  // Bearer token configuration
  bearer?: {
    tokenHeader?: string; // Default: 'Authorization'
    tokenPrefix?: string; // Default: 'Bearer'
    validateToken?: (token: string) => Promise<AuthResult>;
  };
  
  // API Key configuration
  apikey?: {
    keyHeader?: string;   // Default: 'X-API-Key'
    validateKey?: (key: string) => Promise<AuthResult>;
  };
  
  // OAuth 2.0 configuration
  oauth2?: {
    issuer: string;
    audience: string;
    scope?: string[];
    validateClaims?: (claims: any) => Promise<AuthResult>;
  };
}
```

## Package Architecture

### Builder Pattern for MCP Configuration

El paquete `@voltrix/mcp` utiliza el patrón Builder para configuración fluida y tipada, junto con un sistema de plugins completamente extensible:

```typescript
// Builder Pattern para configuración fluida y validada
export class VoltrixMcpBuilder {
  private config: McpServerConfig = {};
  private plugins: McpPlugin[] = [];
  private middleware: McpMiddleware[] = [];
  private validationRules: ValidationRule[] = [];
  
  static create(): VoltrixMcpBuilder {
    return new VoltrixMcpBuilder();
  }
  
  // Configuración del servidor con validación
  server(config: {
    name: string;
    version: string;
    description?: string;
    port?: number;
  }): VoltrixMcpBuilder {
    this.validateServerConfig(config);
    this.config = { ...this.config, ...config };
    return this;
  }
  
  // Agregar plugins con validación de compatibilidad
  withPlugin<T extends McpPlugin>(plugin: T): VoltrixMcpBuilder & WithPluginTypes<T> {
    // Validar configuración del plugin
    const validation = plugin.validateConfig?.(plugin.config);
    if (validation && !validation.valid) {
      throw new Error(`Plugin ${plugin.id} configuration invalid: ${validation.errors.join(', ')}`);
    }
    
    // Verificar compatibilidad con plugins existentes
    for (const existingPlugin of this.plugins) {
      if (!plugin.isCompatibleWith?.(existingPlugin)) {
        throw new Error(`Plugin ${plugin.id} is incompatible with ${existingPlugin.id}`);
      }
      
      const conflicts = plugin.conflictsWith?.(existingPlugin) || [];
      if (conflicts.length > 0) {
        throw new Error(`Plugin conflicts: ${conflicts.join(', ')}`);
      }
    }
    
    this.plugins.push(plugin);
    return this as any;
  }
  
  // Configurar transporte con validación
  transport(config: TransportConfig): VoltrixMcpBuilder {
    this.validateTransportConfig(config);
    this.config.transport = config;
    return this;
  }
  
  // Configurar seguridad
  security(config: SecurityConfig): VoltrixMcpBuilder {
    this.validateSecurityConfig(config);
    this.config.security = config;
    return this;
  }
  
  // Agregar middleware con orden de prioridad
  use(middleware: McpMiddleware): VoltrixMcpBuilder {
    this.middleware.push(middleware);
    // Ordenar por prioridad
    this.middleware.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    return this;
  }
  
  // Validación personalizada
  addValidation(rule: ValidationRule): VoltrixMcpBuilder {
    this.validationRules.push(rule);
    return this;
  }
  
  // Build final con validación completa
  build(): McpSystem {
    this.performFinalValidation();
    return new McpSystem(this.config, this.plugins, this.middleware);
  }
  
  private performFinalValidation(): void {
    // Validaciones básicas
    if (!this.config.name) throw new Error('Server name is required');
    if (!this.config.version) throw new Error('Server version is required');
    
    // Validar dependencias de plugins
    this.validatePluginDependencies();
    
    // Validar configuración de transporte
    this.validateTransportConfig();
    
    // Aplicar reglas de validación personalizadas
    for (const rule of this.validationRules) {
      const result = rule.validate(this.config, this.plugins);
      if (!result.valid) {
        throw new Error(`Validation failed: ${result.error}`);
      }
    }
  }
  
  private validatePluginDependencies(): void {
    for (const plugin of this.plugins) {
      if (plugin.dependencies) {
        for (const dependency of plugin.dependencies) {
          const found = this.plugins.some(p => p.id === dependency);
          if (!found) {
            throw new Error(`Plugin ${plugin.id} requires dependency: ${dependency}`);
          }
        }
      }
    }
  }
}

// Factory Functions con Builder Integration
export const VoltrixMcp = {
  // Builder para configuración avanzada
  builder: () => VoltrixMcpBuilder.create(),
  
  // Factory rápido para casos simples
  create: (config: QuickConfig) => {
    return VoltrixMcpBuilder
      .create()
      .server(config.server)
      .withPlugin(...(config.plugins || []))
      .build();
  },
  
  // Presets para casos comunes
  presets: {
    // Preset optimizado para ChatGPT Apps
    chatgpt: (config: ChatGptPresetConfig) => 
      VoltrixMcpBuilder
        .create()
        .server(config.server)
        .withPlugin(ChatGPTPlugin({
          id: config.chatgpt?.id || 'chatgpt',
          ...config.chatgpt,
          cors: { origin: ['https://chat.openai.com', 'https://chatgpt.com'] },
          ui: { theme: 'modern', animations: true, ...config.chatgpt?.ui }
        }))
        .transport({ 
          websocket: { port: 3001, heartbeat: 30000 },
          http: { port: 3002, cors: true }
        })
        .security({ 
          rateLimiting: { requests: 1000, window: '1h' },
          contentValidation: true
        })
        .use(CompressionMiddleware({ level: 6 }))
        .use(CacheMiddleware({ ttl: 3600 }))
        .build(),
    
    // Preset para empresas con seguridad avanzada
    enterprise: (config: EnterprisePresetConfig) =>
      VoltrixMcpBuilder
        .create()
        .server(config.server)
        .withPlugin(AuthPlugin({
          id: 'auth',
          type: 'jwt',
          issuer: config.auth.issuer,
          audience: config.auth.audience
        }))
        .withPlugin(AnalyticsPlugin({
          id: 'analytics',
          endpoint: config.analytics.endpoint,
          trackPerformance: true,
          realTimeMetrics: true
        }))
        .withPlugin(SecurityPlugin({
          id: 'security',
          encryption: { enabled: true, algorithm: 'AES-256-GCM' },
          auditLogging: { enabled: true, level: 'all' }
        }))
        .transport({ 
          https: { 
            port: 443, 
            ssl: { cert: config.ssl.cert, key: config.ssl.key }
          }
        })
        .security({ 
          authentication: { required: true, type: 'jwt' },
          rateLimiting: { requests: 5000, window: '1h' },
          ddosProtection: { enabled: true, threshold: 100 }
        })
        .use(SecurityMiddleware({ level: 'strict' }))
        .use(AuditMiddleware({ logLevel: 'all' }))
        .build(),
    
    // Preset para desarrollo con debugging
    development: (config: DevPresetConfig) =>
      VoltrixMcpBuilder
        .create()
        .server({ ...config.server, port: config.server.port || 3000 })
        .withPlugin(DebugPlugin({
          id: 'debug',
          logLevel: 'debug',
          includeStackTraces: true,
          performanceMonitoring: true
        }))
        .withPlugin(MockPlugin({
          id: 'mock',
          enabled: config.mock?.enabled || false,
          responses: config.mock?.responses || {}
        }))
        .transport({ 
          http: { port: 3000, cors: { origin: '*' } },
          stdio: { enabled: true }
        })
        .security({ 
          authentication: { required: false },
          rateLimiting: { requests: 10000, window: '1h' }
        })
        .use(DebugMiddleware({ verboseLogging: true }))
        .use(HotReloadMiddleware({ watchFiles: true }))
        .build()
  }
};

// Ejemplo de uso del Builder Pattern
const mcpSystem = VoltrixMcp.builder()
  .server({
    name: 'advanced-data-server',
    version: '2.0.0',
    description: 'Advanced data analysis server with multi-client support'
  })
  // Plugin ChatGPT con configuración completa
  .withPlugin(ChatGPTPlugin({
    id: 'chatgpt-prod',
    cors: { origin: 'https://chat.openai.com', credentials: true },
    ui: { 
      theme: 'modern', 
      animations: true,
      brandColor: '#4CAF50',
      welcomeMessage: '🚀 ¡Hola! Soy tu asistente de análisis de datos.',
      categories: ['analysis', 'reports', 'visualization']
    },
    rateLimiting: { requests: 1000, window: '1h' },
    analytics: { enabled: true, trackUserInteractions: true }
  }))
  // Plugin de Analytics con métricas personalizadas
  .withPlugin(AnalyticsPlugin({
    id: 'analytics',
    trackPerformance: true,
    realTimeMetrics: true,
    customMetrics: ['processing_time', 'data_size', 'ui_interactions'],
    alerting: {
      slowQueries: { threshold: '500ms', action: 'log' },
      highMemory: { threshold: '500MB', action: 'alert' }
    }
  }))
  // Configuración de transporte multi-canal
  .transport({
    websocket: { 
      port: 3001, 
      path: '/ws',
      heartbeat: 30000,
      maxConnections: 10000
    },
    http: { 
      port: 3002, 
      path: '/mcp',
      cors: {
        origin: ['https://chat.openai.com', 'https://chatgpt.com'],
        credentials: true,
        methods: ['GET', 'POST', 'OPTIONS']
      }
    },
    stdio: { 
      enabled: true,
      format: 'json-rpc'
    }
  })
  // Configuración de seguridad avanzada
  .security({
    rateLimiting: { 
      requests: 1000, 
      window: '1h',
      keyGenerator: (req) => req.clientInfo.id
    },
    contentValidation: {
      enabled: true,
      maxRequestSize: '10MB',
      allowedMimeTypes: ['application/json', 'text/plain']
    },
    auditLogging: {
      enabled: true,
      includeRequestBody: false,
      includeResponseBody: true
    }
  })
  // Middleware stack ordenado por prioridad
  .use(CompressionMiddleware({ 
    level: 6, 
    threshold: 1024,
    priority: 100 
  }))
  .use(CacheMiddleware({ 
    ttl: 3600, 
    maxSize: '1GB',
    strategy: 'lru',
    priority: 90
  }))
  .use(MetricsMiddleware({ 
    enabled: true, 
    endpoint: '/metrics',
    includeCustomMetrics: true,
    priority: 80
  }))
  // Validaciones personalizadas
  .addValidation({
    name: 'chatgpt-compatibility',
    validate: (config, plugins) => {
      const chatgptPlugin = plugins.find(p => p.id.includes('chatgpt'));
      if (chatgptPlugin && !config.transport?.websocket) {
        return { 
          valid: false, 
          error: 'ChatGPT plugin requires WebSocket transport' 
        };
      }
      return { valid: true };
    }
  })
  .build();

// Los decoradores se generan automáticamente con tipado completo
const { McpTool, McpResource, McpPrompt, VoltrixMcpServer } = mcpSystem.decorators;
```

```typescript
// Creación del sistema MCP con plugins
const { McpTool, McpResource, McpPrompt, VoltrixMcpServer } = VoltrixMcp.create({
  plugins: [
    ChatGPTPlugin({
      id: 'chatgpt',
      manifestUrl: '/chatgpt-manifest.json',
      cors: { origin: 'https://chat.openai.com' },
      ui: {
        categories: ['productivity', 'analysis'],
        welcomeMessage: 'Hello from ChatGPT plugin!'
      }
    }),
    ClaudePlugin({
      id: 'claude',
      maxTokens: 8000,
      streaming: true,
      anthropicIntegration: true
    }),
    CustomAnalyticsPlugin({
      id: 'analytics',
      trackEvents: ['tool_call', 'resource_access'],
      endpoint: 'https://analytics.example.com'
    })
  ]
});

// Los decoradores son automáticamente tipados con las extensiones de los plugins
@McpTool({
  name: "analyze_data",
  description: "Analyze data with plugin enhancements",
  // Tipado extendido automáticamente por ChatGPTPlugin
  chatgpt: {
    category: 'analysis',
    dangerous: false,
    confirmationRequired: true
  },
  // Tipado extendido automáticamente por ClaudePlugin
  claude: {
    streamingSupported: true,
    maxContextTokens: 8000
  },
  // Tipado extendido automáticamente por CustomAnalyticsPlugin
  analytics: {
    trackPerformance: true,
    customMetrics: ['execution_time', 'data_size']
  }
})
async analyzeData(@McpArgs() args: AnalysisArgs) {
  // Implementation
}
```

### Response Transformation Stack

Cada plugin puede transformar las respuestas manteniendo trazabilidad completa:

```typescript
interface PluginOutput<T = any> {
  value: T;
  original: T;
  transformations: Array<{
    pluginId: string;
    pluginName: string;
    timestamp: Date;
    operation: string;
    metadata?: any;
  }>;
  // Cada plugin puede agregar su propia sección
  [pluginId: string]: any;
}

// Ejemplo de respuesta transformada por múltiples plugins
const output: PluginOutput<string> = {
  value: "## Analysis Results\n\n**Data processed successfully**\n\n*Optimized for ChatGPT display*",
  original: "Data processed successfully",
  transformations: [
    {
      pluginId: 'markdown',
      pluginName: 'MarkdownFormatterPlugin',
      timestamp: new Date(),
      operation: 'format_to_markdown'
    },
    {
      pluginId: 'chatgpt',
      pluginName: 'ChatGPTPlugin',
      timestamp: new Date(),
      operation: 'optimize_for_display',
      metadata: { tokenCount: 25, formatted: true }
    }
  ],
  // Datos específicos de cada plugin
  chatgpt: {
    optimized: true,
    tokenCount: 25,
    categories: ['analysis']
  },
  markdown: {
    formatted: true,
    structure: 'headers_and_emphasis'
  }
};
```

### Core Components

1. **VoltrixMcp.create()** - Factory function for creating typed MCP system with plugins
2. **@VoltrixMcpServer** - Main server decorator with plugin-extended typing
3. **@McpResource** - Resource endpoint decorator with plugin extensions
4. **@McpTool** - Tool function decorator with plugin extensions
5. **@McpPrompt** - Prompt template decorator with plugin extensions

### Plugin System Architecture

```typescript
// Plugin base interface con tipado extensible
interface McpPlugin<TConfig = any, TExtensions = any> {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly config: TConfig;
  
  // Lifecycle hooks
  initialize?(server: VoltrixMcpServer): Promise<void>;
  shutdown?(): Promise<void>;
  
  // Configuration extension
  extendServerConfig?(config: McpServerConfig): McpServerConfig;
  extendToolConfig?(config: McpToolConfig): McpToolConfig & TExtensions;
  extendResourceConfig?(config: McpResourceConfig): McpResourceConfig & TExtensions;
  extendPromptConfig?(config: McpPromptConfig): McpPromptConfig & TExtensions;
  
  // Middleware stack
  beforeRequest?(request: McpRequest, context: PluginContext): Promise<McpRequest>;
  afterRequest?(response: PluginOutput, request: McpRequest, context: PluginContext): Promise<PluginOutput>;
  
  // Transform responses
  transformToolResponse?(response: any, context: ToolContext): Promise<PluginOutput>;
  transformResourceResponse?(response: any, context: ResourceContext): Promise<PluginOutput>;
  transformPromptResponse?(response: any, context: PromptContext): Promise<PluginOutput>;
}

// Plugin context con helpers
interface PluginContext {
  server: VoltrixMcpServer;
  request: McpRequest;
  pluginId: string;
  
  // Plugin interaction helpers
  isPluginInstalled(pluginId: string): boolean;
  getPluginConfig<T = any>(pluginId: string): T | undefined;
  getPluginData<T = any>(pluginId: string, key: string): T | undefined;
  setPluginData<T = any>(pluginId: string, key: string, value: T): void;
  
  // Cross-plugin communication
  callPlugin<T = any>(pluginId: string, method: string, ...args: any[]): Promise<T>;
  emitEvent(event: string, data: any): void;
  onEvent(event: string, handler: (data: any) => void): void;
}

// Extensible typing system
type ExtendableConfig<TBase, TPlugins extends readonly McpPlugin[]> = TBase & 
  UnionToIntersection<
    {
      [K in keyof TPlugins]: TPlugins[K] extends McpPlugin<any, infer TExtensions>
        ? { [P in TPlugins[K]['id']]?: TExtensions }
        : never;
    }[number]
  >;

// Built-in plugins with typed extensions
interface ChatGPTPluginExtensions {
  category?: string;
  dangerous?: boolean;
  confirmationRequired?: boolean;
  confirmationMessage?: string;
  progress?: boolean;
  temperature?: number;
  ui?: {
    icon?: string;
    color?: string;
    description?: string;
  };
}

interface ClaudePluginExtensions {
  streamingSupported?: boolean;
  maxContextTokens?: number;
  modelPreference?: 'claude-3' | 'claude-2' | 'auto';
  safetyLevel?: 'strict' | 'moderate' | 'permissive';
}

interface AnalyticsPluginExtensions {
  trackPerformance?: boolean;
  customMetrics?: string[];
  sampleRate?: number;
  excludeFromAnalytics?: boolean;
}

// Core type system for extensible configuration
type UnionToIntersection<U> = 
  (U extends any ? (k: U) => void : never) extends ((k: infer I) => void) ? I : never;

type PluginExtensions<TPlugins extends readonly McpPlugin[]> = UnionToIntersection<
  {
    [K in keyof TPlugins]: TPlugins[K] extends McpPlugin<any, infer TExtensions>
      ? { [P in TPlugins[K]['id']]?: TExtensions }
      : never;
  }[number]
>;

// Extended configurations with plugin support
type ExtendedToolConfig<TPlugins extends readonly McpPlugin[]> = 
  McpToolConfig & PluginExtensions<TPlugins>;

type ExtendedResourceConfig<TPlugins extends readonly McpPlugin[]> = 
  McpResourceConfig & PluginExtensions<TPlugins>;

type ExtendedPromptConfig<TPlugins extends readonly McpPlugin[]> = 
  McpPromptConfig & PluginExtensions<TPlugins>;

// Plugin output interface with transformation stack
interface PluginOutput<T = any> {
  value: T;
  original: T;
  transformations: Array<{
    pluginId: string;
    pluginName: string;
    timestamp: Date;
    operation: string;
    metadata?: any;
  }>;
  // Dynamic plugin data (cada plugin puede agregar su sección)
  [pluginId: string]: any;
}
```
  temperature?: number;
  ui?: {
    icon?: string;
    color?: string;
    description?: string;
  };
}

interface ClaudePluginExtensions {
  streamingSupported?: boolean;
  maxContextTokens?: number;
  modelPreference?: 'claude-3' | 'claude-2' | 'auto';
  safetyLevel?: 'strict' | 'moderate' | 'permissive';
}

interface AnalyticsPluginExtensions {
  trackPerformance?: boolean;
  customMetrics?: string[];
  sampleRate?: number;
  excludeFromAnalytics?: boolean;
}
```

### Plugin Creation Examples

```typescript
// ChatGPT Plugin implementation con ID configurable
export const ChatGPTPlugin = (config: ChatGPTPluginConfig & { id?: string }): McpPlugin<ChatGPTPluginConfig, ChatGPTPluginExtensions> => ({
  id: config.id || 'chatgpt', // ID por defecto, pero puede ser personalizado
  name: 'ChatGPT Integration Plugin',
  version: '1.0.0',
  config,

  extendToolConfig(toolConfig) {
    return {
      ...toolConfig,
      // Agrega propiedades específicas de ChatGPT al tipado
      [this.id]: undefined as ChatGPTPluginExtensions | undefined
    };
  },

  transformToolResponse(response, context) {
    const { pluginId, isPluginInstalled, getPluginConfig } = context;
    
    // Verifica si hay otros plugins que puedan afectar la respuesta
    const hasMarkdownPlugin = isPluginInstalled('markdown');
    const analyticsConfig = getPluginConfig<AnalyticsPluginExtensions>('analytics');
    
    // Transforma la respuesta para ChatGPT
    const transformed = this.optimizeForChatGPT(response, context);
    
    return {
      value: transformed,
      original: response,
      transformations: [{
        pluginId: this.id, // Usa el ID configurado
        pluginName: this.name,
        timestamp: new Date(),
        operation: 'optimize_for_chatgpt',
        metadata: { 
          hasMarkdownPlugin,
          analyticsEnabled: !!analyticsConfig 
        }
      }],
      [this.id]: { // Sección dinámica basada en el ID
        optimized: true,
        tokenCount: this.estimateTokens(transformed),
        compatible: true
      }
    };
  },

  private optimizeForChatGPT(response: any, context: ToolContext): string {
    // Lógica de optimización específica para ChatGPT
    if (typeof response === 'object') {
      return this.formatObjectForChatGPT(response);
    }
    return String(response);
  }
});

// Custom Analytics Plugin con ID totalmente personalizable
export const AnalyticsPlugin = (config: AnalyticsPluginConfig & { id?: string }): McpPlugin<AnalyticsPluginConfig, AnalyticsPluginExtensions> => ({
  id: config.id || 'analytics', // Permite IDs como 'custom-analytics', 'google-analytics', etc.
  name: config.name || 'Analytics Plugin',
  version: '1.0.0',
  config,

  extendToolConfig(toolConfig) {
    return {
      ...toolConfig,
      [this.id]: undefined as AnalyticsPluginExtensions | undefined
    };
  },

  beforeRequest(request, context) {
    // Tracking de requests usando el ID configurado
    if (this.config.trackRequests) {
      this.trackEvent('request_started', {
        pluginId: this.id,
        method: request.method,
        timestamp: Date.now(),
        clientInfo: context.request.clientInfo
      });
    }
    return request;
  },

  transformToolResponse(response, context) {
    const toolConfig = context.toolConfig[this.id]; // Acceso dinámico por ID
    
    if (toolConfig?.trackPerformance) {
      const performanceData = this.measurePerformance(context);
      
      // No modifica la respuesta, solo agrega metadatos
      return {
        value: response,
        original: response,
        transformations: [{
          pluginId: this.id,
          pluginName: this.name,
          timestamp: new Date(),
          operation: 'track_performance'
        }],
        [this.id]: { // Sección con nombre dinámico
          performance: performanceData,
          tracked: true,
          metrics: toolConfig.customMetrics || []
        }
      };
    }
    
    return response;
  }
});

// Plugin personalizado con ID completamente libre
export const CustomPlugin = (config: {
  id: string; // ID obligatorio para plugins personalizados
  name: string;
  version?: string;
  extensions?: any;
  [key: string]: any;
}): McpPlugin => ({
  id: config.id, // ID completamente personalizable
  name: config.name,
  version: config.version || '1.0.0',
  config,

  extendToolConfig(toolConfig) {
    return {
      ...toolConfig,
      [this.id]: config.extensions
    };
  },

  transformToolResponse(response, context) {
    // Lógica personalizada del plugin
    const customLogic = config.transformResponse;
    if (customLogic) {
      const transformed = customLogic(response, context);
      return {
        value: transformed,
        original: response,
        transformations: [{
          pluginId: this.id,
          pluginName: this.name,
          timestamp: new Date(),
          operation: 'custom_transform'
        }],
        [this.id]: {
          customProcessed: true,
          ...config.metadata
        }
      };
    }
    return response;
  }
});
```

### Usage Examples with Custom IDs

```typescript
// Múltiples instancias del mismo plugin con IDs diferentes
const { McpTool, VoltrixMcpServer } = VoltrixMcp.create({
  plugins: [
    // ChatGPT plugin para producción
    ChatGPTPlugin({
      id: 'chatgpt-prod',
      enabled: true,
      manifestUrl: '/chatgpt-manifest.json',
      cors: { origin: 'https://chat.openai.com' }
    }),
    
    // ChatGPT plugin para testing
    ChatGPTPlugin({
      id: 'chatgpt-test',
      enabled: false, // Deshabilitado en producción
      manifestUrl: '/chatgpt-test-manifest.json',
      cors: { origin: 'https://test.openai.com' }
    }),
    
    // Múltiples analytics
    AnalyticsPlugin({
      id: 'google-analytics',
      name: 'Google Analytics Integration',
      trackPerformance: true,
      endpoint: 'https://analytics.google.com/api'
    }),
    
    AnalyticsPlugin({
      id: 'internal-analytics',
      name: 'Internal Analytics System',
      trackPerformance: true,
      endpoint: 'https://internal-analytics.company.com'
    }),
    
    // Plugin completamente personalizado
    CustomPlugin({
      id: 'company-security',
      name: 'Company Security Plugin',
      version: '2.1.0',
      extensions: {
        requiresAuth?: boolean;
        securityLevel?: 'low' | 'medium' | 'high';
        auditLog?: boolean;
      },
      transformResponse: (response, context) => {
        // Lógica de seguridad personalizada
        return this.sanitizeResponse(response);
      }
    })
  ] as const
});

// Uso con IDs personalizados en decoradores
@McpTool({
  name: "secure_data_processing",
  description: "Process data with multiple analytics and security layers",
  
  // Configuración para ChatGPT de producción
  'chatgpt-prod': {
    category: 'data_processing',
    dangerous: false,
    confirmationRequired: true
  },
  
  // Configuración para ChatGPT de testing (diferente)
  'chatgpt-test': {
    category: 'testing',
    dangerous: true, // Permite operaciones peligrosas en test
    confirmationRequired: false
  },
  
  // Google Analytics
  'google-analytics': {
    trackPerformance: true,
    customMetrics: ['processing_time', 'data_size']
  },
  
  // Internal Analytics con métricas diferentes
  'internal-analytics': {
    trackPerformance: true,
    customMetrics: ['user_id', 'department', 'cost_center']
  },
  
  // Plugin de seguridad personalizado
  'company-security': {
    requiresAuth: true,
    securityLevel: 'high',
    auditLog: true
  }
})
async secureDataProcessing(
  @McpArgs() args: DataProcessingArgs,
  @PluginContext() context: PluginContext
) {
  // Acceso a plugins por ID personalizado
  const isProdChatGpt = context.isPluginInstalled('chatgpt-prod');
  const isTestChatGpt = context.isPluginInstalled('chatgpt-test');
  
  const googleAnalytics = context.getPluginConfig('google-analytics');
  const internalAnalytics = context.getPluginConfig('internal-analytics');
  const securityConfig = context.getPluginConfig('company-security');
  
  // Lógica específica según plugins instalados
  if (securityConfig?.requiresAuth) {
    await this.validateUserAuthentication();
  }
  
  // Processing
  const result = await this.processData(args);
  
  // Los plugins transformarán automáticamente según su ID
  return result;
}
```

### TypeScript Interface Support

```typescript
// Plugin System Interfaces
interface McpPlugin {
  name: string;
  version: string;
  initialize(server: VoltrixMcpServer): Promise<void>;
  shutdown(): Promise<void>;
  configureServer?(config: McpServerConfig): McpServerConfig;
  handleRequest?(request: McpRequest, next: NextFunction): Promise<McpResponse>;
  handleResponse?(response: McpResponse, request: McpRequest): Promise<McpResponse>;
}

interface PluginConfig {
  [key: string]: any;
}

// Built-in Plugin Configurations
interface ChatGPTPluginConfig extends PluginConfig {
  enabled?: boolean;
  manifestUrl?: string;
  description?: string;
  categories?: string[];
  cors?: {
    origin: string | string[];
    credentials?: boolean;
    methods?: string[];
    headers?: string[];
  };
  customManifest?: Partial<ChatGptManifest>;
  ui?: {
    welcomeMessage?: string;
    suggestedPrompts?: string[];
    themes?: string[];
  };
  rateLimiting?: {
    requests: number;
    window: string;
  };
  analytics?: {
    enabled: boolean;
    events?: string[];
  };
}

interface ClaudePluginConfig extends PluginConfig {
  enabled?: boolean;
  maxTokens?: number;
  streaming?: boolean;
  anthropicApiKey?: string;
  modelVersion?: string;
  safetySettings?: {
    blockHarmfulContent: boolean;
    contentFilters: string[];
  };
}

interface CustomPluginConfig extends PluginConfig {
  clientDetection?: {
    userAgent?: RegExp;
    headers?: Record<string, string | RegExp>;
  };
  responseFormat?: 'json' | 'markdown' | 'html' | 'xml';
  features?: string[];
}

// Interfaces para opciones tipadas
interface ResourceOptions {
  [key: string]: any;
}

interface ToolArgs {
  [key: string]: any;
}

interface PromptArgs {
  [key: string]: any;
}

interface McpRequestContext {
  clientInfo: {
    name: string;
    version: string;
    userAgent?: string;
    pluginContext?: Record<string, any>;
  };
  user?: {
    id: string;
    roles: string[];
  };
  headers: Record<string, string>;
  timestamp: Date;
  plugins: {
    [pluginName: string]: any;
  };
}
```

### Integration with Voltrix Framework

- **Dependency Injection** - Full DI container integration
- **Middleware Support** - Standard Voltrix middleware compatibility
- **Type Safety** - Complete TypeScript type definitions
- **Performance** - Zero-overhead decorator implementations
- **Testing** - Real MCP client testing capabilities

## Decorator Patterns

### Plugin-Aware Server Creation

```typescript
// Creación del sistema MCP con plugins tipados
const { McpTool, McpResource, McpPrompt, VoltrixMcpServer } = VoltrixMcp.create({
  plugins: [
    ChatGPTPlugin({
      id: 'my-chatgpt', // ID personalizado opcional
      enabled: true,
      manifestUrl: '/chatgpt-manifest.json',
      categories: ['productivity', 'analysis'],
      ui: {
        welcomeMessage: 'Hello! I can help with data analysis and file operations.',
        suggestedPrompts: [
          'Analyze this spreadsheet',
          'Create a backup',
          'Generate a report'
        ]
      }
    }),
    ClaudePlugin({
      id: 'claude-v3', // ID personalizado para identificar versión
      maxTokens: 8000,
      streaming: true,
      modelPreference: 'claude-3'
    }),
    AnalyticsPlugin({
      id: 'prod-analytics', // ID específico para producción
      trackPerformance: true,
      endpoint: 'https://analytics.example.com',
      customDimensions: { service: 'mcp-server', environment: 'production' }
    })
  ] as const
});

// Server decorator con configuración extendida automáticamente
@VoltrixMcpServer({
  name: "advanced-mcp-server",
  version: "2.0.0",
  port: 3001,
  // Configuraciones específicas de plugins usando IDs personalizados
  'my-chatgpt': {
    enabled: true,
    cors: { origin: 'https://chat.openai.com' }
  },
  'claude-v3': {
    enabled: true,
    streaming: true
  },
  'prod-analytics': {
    trackRequests: true,
    sampleRate: 0.1
  }
})
export class AdvancedMcpServer {
  // Implementation
}
```

### Resource Decorator con Plugin Extensions

```typescript
interface FileAccessOptions {
  encoding?: 'utf8' | 'base64' | 'binary';
  maxSize?: number;
  cache?: boolean;
}

@McpResource({
  uri: "file://documents/*",
  name: "Document Access",
  description: "Access to document files with multi-client optimization",
  optionsSchema: {
    type: "object",
    properties: {
      encoding: { type: "string", enum: ["utf8", "base64", "binary"], default: "utf8" },
      maxSize: { type: "number", minimum: 1, maximum: 10485760, default: 1048576 },
      cache: { type: "boolean", default: true }
    }
  },
  // Configuración automáticamente tipada por ChatGPTPlugin
  'my-chatgpt': {
    category: 'file_operations',
    previewable: true,
    cacheable: true,
    maxCacheTime: 3600
  },
  // Configuración automáticamente tipada por ClaudePlugin
  'claude-v3': {
    streamingSupported: false, // Files no soportan streaming
    maxContextTokens: 4000
  },
  // Configuración automáticamente tipada por AnalyticsPlugin
  'prod-analytics': {
    trackPerformance: true,
    customMetrics: ['file_size', 'access_time'],
    excludeFromAnalytics: false
  }
})
async getDocument(
  @McpParams() params: { path: string },
  @McpOptions() options: FileAccessOptions = {},
  @PluginContext() context: PluginContext
): Promise<PluginOutput<Resource[]>> {
  const { encoding = 'utf8', maxSize = 1048576, cache = true } = options;
  
  // Acceso a helpers de plugins
  const isChatGptRequest = context.isPluginInstalled('my-chatgpt') && 
    context.getPluginData('my-chatgpt', 'isActiveClient');
  
  const analyticsConfig = context.getPluginConfig<AnalyticsPluginConfig>('prod-analytics');
  
  // Lógica específica según el cliente
  if (isChatGptRequest) {
    // Optimización para ChatGPT
    return this.readFileForChatGPT(params.path, { encoding, maxSize, cache });
  }
  
  return this.readFileStandard(params.path, { encoding, maxSize, cache });
}
```

### Tool Decorator con Transformation Stack

```typescript
interface DataProcessingArgs {
  data: string;
  format?: 'json' | 'csv' | 'xml';
  options?: {
    validateSchema?: boolean;
    includeMetadata?: boolean;
    outputFormat?: 'object' | 'string' | 'stream';
  };
}

@McpTool({
  name: "process_data",
  description: "Process data with intelligent client-specific optimizations",
  inputSchema: {
    type: "object",
    properties: {
      data: { type: "string", description: "Data to process" },
      format: { type: "string", enum: ["json", "csv", "xml"], default: "json" },
      options: {
        type: "object",
        properties: {
          validateSchema: { type: "boolean", default: true },
          includeMetadata: { type: "boolean", default: false },
          outputFormat: { type: "string", enum: ["object", "string", "stream"], default: "object" }
        }
      }
    },
    required: ["data"]
  },
  // Configuraciones específicas de cada plugin
  'my-chatgpt': {
    category: 'data_processing',
    dangerous: false,
    confirmationRequired: false,
    progress: true, // Reporta progreso para datasets grandes
    ui: {
      icon: '⚙️',
      color: '#4CAF50',
      description: 'Process and transform your data intelligently'
    }
  },
  'claude-v3': {
    streamingSupported: true,
    maxContextTokens: 8000,
    modelPreference: 'claude-3',
    safetyLevel: 'moderate'
  },
  'prod-analytics': {
    trackPerformance: true,
    customMetrics: ['processing_time', 'data_size', 'format_type'],
    sampleRate: 1.0 // Track todas las ejecuciones
  }
})
async processData(
  @McpArgs() args: DataProcessingArgs,
  @PluginContext() context: PluginContext
): Promise<PluginOutput<ProcessedData>> {
  
  // Helpers de plugins disponibles
  const {
    isPluginInstalled,
    getPluginConfig,
    getPluginData,
    setPluginData,
    callPlugin,
    emitEvent
  } = context;
  
  // Verifica qué plugins están activos
  const hasChatGptPlugin = isPluginInstalled('my-chatgpt');
  const hasAnalyticsPlugin = isPluginInstalled('prod-analytics');
  
  // Emite evento de inicio para analytics
  if (hasAnalyticsPlugin) {
    emitEvent('processing_started', {
      dataSize: args.data.length,
      format: args.format,
      timestamp: Date.now()
    });
  }
  
  // Procesamiento principal
  const startTime = Date.now();
  const result = await this.performDataProcessing(args);
  const processingTime = Date.now() - startTime;
  
  // Notifica progreso si es necesario
  if (hasChatGptPlugin) {
    setPluginData('my-chatgpt', 'lastProcessingTime', processingTime);
  }
  
  // Retorna resultado - los plugins automáticamente lo transformarán
  // según su configuración en el stack de middleware
  return {
    data: result,
    metadata: {
      processingTime,
      format: args.format,
      size: args.data.length
    }
  };
}
```

### Prompt Decorator con Multi-Client Support

```typescript
interface ReportGenerationArgs {
  dataSource: string;
  reportType: 'summary' | 'detailed' | 'executive';
  language?: 'en' | 'es' | 'fr';
  includeCharts?: boolean;
  customSections?: string[];
}

@McpPrompt({
  name: "generate_report_prompt",
  description: "Generate intelligent prompts for report creation",
  argumentsSchema: {
    type: "object",
    properties: {
      dataSource: { type: "string", description: "Source of data for the report" },
      reportType: { 
        type: "string", 
        enum: ["summary", "detailed", "executive"],
        description: "Type of report to generate"
      },
      language: { type: "string", enum: ["en", "es", "fr"], default: "en" },
      includeCharts: { type: "boolean", default: false },
      customSections: { 
        type: "array", 
        items: { type: "string" },
        description: "Custom sections to include in the report"
      }
    },
    required: ["dataSource", "reportType"]
  },
  // Configuración para diferentes clientes
  'my-chatgpt': {
    category: 'report_generation',
    systemPrompt: true,
    userPrompt: false,
    temperature: 0.3,
    ui: {
      icon: '📊',
      description: 'Generate comprehensive reports from your data'
    }
  },
  'claude-v3': {
    streamingSupported: true,
    maxContextTokens: 8000,
    modelPreference: 'claude-3'
  },
  'prod-analytics': {
    trackPerformance: false, // Los prompts no necesitan tracking de performance
    customMetrics: ['report_type', 'language', 'sections_count']
  }
})
generateReportPrompt(
  @PromptArgs() args: ReportGenerationArgs,
  @PluginContext() context: PluginContext
): PromptTemplate {
  
  const { dataSource, reportType, language = 'en', includeCharts = false, customSections = [] } = args;
  
  // Adaptación automática según el cliente
  const clientInfo = context.request.clientInfo;
  const isChatGptClient = context.isPluginInstalled('my-chatgpt');
  
  // Template base
  const basePrompt = this.generateBasePrompt(args);
  
  // Optimización específica por cliente
  if (isChatGptClient) {
    return this.optimizeForChatGPT(basePrompt, args);
  }
  
  return basePrompt;
}
```

## Performance Optimizations

### Runtime Optimizations
- **Lazy Loading** - Resources loaded on demand
- **Connection Pooling** - Efficient connection management
- **Metadata Caching** - Decorator metadata cached at startup
- **Zero Allocations** - Reused objects in hot paths

### Memory Management
- **Resource Cleanup** - Automatic resource disposal
- **Connection Limits** - Configurable connection limits
- **Buffer Pooling** - Reused buffers for I/O operations
- **Weak References** - Prevent memory leaks in long-running servers

## Security Features

### Authentication & Authorization
- **Token-based Auth** - JWT token support
- **Role-based Access** - Fine-grained permissions
- **Rate Limiting** - Request throttling
- **Input Validation** - Automatic parameter validation

### Data Protection
- **Encrypted Transport** - TLS/SSL support
- **Data Sanitization** - Automatic data cleaning
- **Audit Logging** - Complete request/response logging
- **Sandbox Execution** - Isolated tool execution

## Integration Examples

### Basic MCP Server con Opciones Tipadas
```typescript
import { VoltrixMcpServer, McpResource, McpTool } from '@voltrix/mcp';

interface FileReadOptions {
  encoding?: 'utf8' | 'base64' | 'binary';
  maxSize?: number;
  cache?: boolean;
}

interface FileWriteArgs {
  path: string;
  content: string;
  encoding?: 'utf8' | 'base64';
  mode?: number;
  createDirs?: boolean;
}

@VoltrixMcpServer({
  name: "file-server",
  version: "1.0.0",
  // Configuración para ChatGPT Apps
  chatgpt: {
    enabled: true,
    manifestUrl: "/mcp-manifest.json",
    description: "File management server for AI applications",
    cors: {
      origin: ["https://chat.openai.com", "https://chatgpt.com"],
      credentials: true
    }
  }
})
export class FileServer {
  
  @McpResource({ 
    uri: "file://documents/*",
    name: "Document Files",
    description: "Access to document files with various formats",
    mimeType: "text/plain",
    optionsSchema: {
      type: "object",
      properties: {
        encoding: { type: "string", enum: ["utf8", "base64", "binary"], default: "utf8" },
        maxSize: { type: "number", minimum: 1, maximum: 10485760, default: 1048576 },
        cache: { type: "boolean", default: true }
      }
    }
  })
  async readFile(
    @McpParams() params: { path: string },
    @McpOptions() options: FileReadOptions = {}
  ) {
    const { encoding = 'utf8', maxSize = 1048576, cache = true } = options;
    // File reading implementation with typed options
    return await this.fileService.readFile(params.path, { encoding, maxSize, cache });
  }
  
  @McpTool({ 
    name: "write_file",
    description: "Write content to a file with specified options",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", pattern: "^[^<>:\"|?*]+$" },
        content: { type: "string" },
        encoding: { type: "string", enum: ["utf8", "base64"], default: "utf8" },
        mode: { type: "number", default: 0o644 },
        createDirs: { type: "boolean", default: true }
      },
      required: ["path", "content"]
    },
    chatgpt: {
      category: "file_operations",
      dangerous: true,
      confirmationRequired: true,
      confirmationMessage: "This will write to the file system. Continue?"
    }
  })
  async writeFile(@McpArgs() args: FileWriteArgs) {
    const { path, content, encoding = 'utf8', mode = 0o644, createDirs = true } = args;
    // File writing implementation with typed arguments
    return await this.fileService.writeFile(path, content, { encoding, mode, createDirs });
  }
}
```

### Advanced Integration with ChatGPT Apps Support
```typescript
import { VoltrixApp, VoltrixModule } from '@voltrix/decorator';
import { VoltrixMcpServer, ChatGptManifest } from '@voltrix/mcp';

interface DatabaseQueryOptions {
  limit?: number;
  offset?: number;
  sort?: string;
  filter?: Record<string, any>;
  include?: string[];
}

interface BackupArgs {
  tables?: string[];
  format?: 'json' | 'sql' | 'csv';
  compress?: boolean;
  destination?: string;
}

@VoltrixModule({
  providers: [DatabaseService, FileService],
  exports: [DatabaseService]
})
export class DataModule {}

@VoltrixMcpServer({
  name: "data-server",
  version: "2.0.0",
  imports: [DataModule],
  // Configuración completa para ChatGPT Apps
  chatgpt: {
    enabled: true,
    manifestUrl: "/mcp-manifest.json",
    description: "Advanced data management server with database and file operations",
    categories: ["database", "file_management", "backup"],
    cors: {
      origin: [
        "https://chat.openai.com",
        "https://chatgpt.com",
        "https://platform.openai.com"
      ],
      credentials: true,
      methods: ["GET", "POST", "OPTIONS"],
      headers: ["Content-Type", "Authorization", "X-MCP-Version"]
    },
    // Manifest personalizado para ChatGPT
    customManifest: {
      name: "Data Server",
      description: "Comprehensive data management with AI-friendly interfaces",
      version: "2.0.0",
      capabilities: {
        resources: { listChanged: true },
        tools: { progress: true },
        prompts: { list: true }
      },
      security: {
        authRequired: false,
        rateLimiting: {
          requests: 1000,
          window: "1h"
        }
      }
    }
  },
  // Transporte automático para diferentes clientes
  transport: {
    type: "auto",
    websocket: { 
      port: 3001,
      path: "/ws",
      heartbeat: 30000
    },
    http: { 
      port: 3002, 
      path: "/mcp",
      cors: true
    },
    stdio: { 
      enabled: true,
      format: "json-rpc"
    }
  }
})
export class DataMcpServer {
  
  constructor(
    private readonly db: DatabaseService,
    private readonly files: FileService
  ) {}
  
  @McpResource({ 
    uri: "database://users",
    name: "User Database",
    description: "Access to user data with advanced querying options",
    optionsSchema: {
      type: "object",
      properties: {
        limit: { type: "number", minimum: 1, maximum: 1000, default: 100 },
        offset: { type: "number", minimum: 0, default: 0 },
        sort: { type: "string", pattern: "^[a-zA-Z_][a-zA-Z0-9_]*(:asc|:desc)?$" },
        filter: { type: "object", additionalProperties: true },
        include: { type: "array", items: { type: "string" } }
      }
    }
  })
  async getUsers(
    @McpParams() params: ResourceParams,
    @McpOptions() options: DatabaseQueryOptions = {}
  ) {
    const { limit = 100, offset = 0, sort, filter = {}, include = [] } = options;
    return this.db.findUsers({ limit, offset, sort, filter, include });
  }
  
  @McpTool({ 
    name: "backup_data",
    description: "Create a backup of database tables with customizable options",
    inputSchema: {
      type: "object",
      properties: {
        tables: { 
          type: "array", 
          items: { type: "string" },
          description: "Tables to backup (empty = all tables)"
        },
        format: { 
          type: "string", 
          enum: ["json", "sql", "csv"], 
          default: "json",
          description: "Output format for backup"
        },
        compress: { 
          type: "boolean", 
          default: true,
          description: "Compress the backup file"
        },
        destination: { 
          type: "string",
          description: "Backup destination path"
        }
      }
    },
    chatgpt: {
      category: "backup",
      dangerous: false,
      confirmationRequired: true,
      confirmationMessage: "This will create a database backup. Continue?",
      progress: true // Reporta progreso para operaciones largas
    }
  })
  async backupData(@McpArgs() args: BackupArgs) {
    const { tables = [], format = 'json', compress = true, destination } = args;
    
    // Inicia el proceso con reporte de progreso
    this.reportProgress(0, "Starting backup process...");
    
    const data = await this.db.exportData(tables, (progress) => {
      this.reportProgress(progress * 0.8, `Exporting data... ${Math.round(progress)}%`);
    });
    
    this.reportProgress(80, "Saving backup file...");
    const result = await this.files.saveBackup(data, { format, compress, destination });
    
    this.reportProgress(100, "Backup completed successfully");
    return { 
      success: true, 
      file: result.path,
      size: result.size,
      format,
      compressed: compress
    };
  }

  @McpPrompt({
    name: "sql_query_assistant",
    description: "Generate SQL queries based on natural language descriptions",
    argumentsSchema: {
      type: "object",
      properties: {
        description: { 
          type: "string",
          description: "Natural language description of the desired query"
        },
        tables: {
          type: "array",
          items: { type: "string" },
          description: "Available tables to query"
        },
        dialect: {
          type: "string",
          enum: ["mysql", "postgresql", "sqlite", "mssql"],
          default: "postgresql"
        },
        complexity: {
          type: "string",
          enum: ["simple", "intermediate", "advanced"],
          default: "intermediate"
        }
      },
      required: ["description"]
    },
    chatgpt: {
      category: "code_generation",
      systemPrompt: true,
      userPrompt: false,
      temperature: 0.3 // Más determinista para código
    }
  })
  sqlQueryAssistant(@PromptArgs() args: {
    description: string;
    tables?: string[];
    dialect?: string;
    complexity?: string;
  }) {
    const { description, tables = [], dialect = 'postgresql', complexity = 'intermediate' } = args;
    
    return {
      messages: [
        {
          role: "system",
          content: {
            type: "text",
            text: `You are an expert SQL developer. Generate ${complexity} ${dialect} queries based on natural language descriptions.
            
Available tables: ${tables.join(', ') || 'Not specified - use common table names'}

Guidelines:
- Generate syntactically correct ${dialect} SQL
- Include appropriate JOINs, WHERE clauses, and ORDER BY when needed
- For ${complexity} complexity: ${this.getComplexityGuidelines(complexity)}
- Always explain the query logic
- Include performance considerations when relevant`
          }
        },
        {
          role: "user",
          content: {
            type: "text",
            text: `Generate a SQL query for: ${description}`
          }
        }
      ]
    };
  }

  private getComplexityGuidelines(complexity: string): string {
    switch (complexity) {
      case 'simple':
        return 'Use basic SELECT, WHERE, ORDER BY. Avoid complex JOINs.';
      case 'intermediate':
        return 'Include JOINs, subqueries, and aggregate functions when appropriate.';
      case 'advanced':
        return 'Use CTEs, window functions, complex subqueries, and optimization techniques.';
      default:
        return 'Use appropriate SQL features for the task.';
    }
  }

  private reportProgress(percentage: number, message: string) {
    // Implementación del reporte de progreso para ChatGPT Apps
    this.mcpServer.sendProgress({
      token: this.currentOperationToken,
      progress: percentage,
      total: 100,
      message
    });
  }
}
```

### ChatGPT Manifest Generator
```typescript
// Generación automática del manifest para ChatGPT Apps
export class ChatGptManifestGenerator {
  static generate(serverClass: any): ChatGptManifest {
    const serverMetadata = Reflect.getMetadata('mcp:server', serverClass);
    const resources = Reflect.getMetadata('mcp:resources', serverClass) || [];
    const tools = Reflect.getMetadata('mcp:tools', serverClass) || [];
    const prompts = Reflect.getMetadata('mcp:prompts', serverClass) || [];

    return {
      schema_version: "1.0",
      name: serverMetadata.name,
      description: serverMetadata.description || serverMetadata.chatgpt?.description,
      version: serverMetadata.version,
      
      // Capacidades detectadas automáticamente
      capabilities: {
        resources: {
          subscribe: resources.some(r => r.observable),
          listChanged: true
        },
        tools: {
          progress: tools.some(t => t.chatgpt?.progress)
        },
        prompts: {
          list: prompts.length > 0
        }
      },

      // Transporte disponible
      transport: this.detectTransport(serverMetadata),

      // Metadatos para ChatGPT
      ui: {
        categories: this.extractCategories(tools, prompts),
        dangerous_actions: tools.filter(t => t.chatgpt?.dangerous).map(t => t.name),
        confirmation_required: tools.filter(t => t.chatgpt?.confirmationRequired).map(t => t.name)
      },

      // Esquemas de tipos para mejor integración
      schemas: {
        resources: resources.map(r => ({
          uri_pattern: r.uri,
          options_schema: r.optionsSchema
        })),
        tools: tools.map(t => ({
          name: t.name,
          input_schema: t.inputSchema
        })),
        prompts: prompts.map(p => ({
          name: p.name,
          arguments_schema: p.argumentsSchema
        }))
      }
    };
  }
}
```

## ChatGPT Apps Integration

### Automatic Client Detection
El servidor MCP detecta automáticamente clientes de ChatGPT Apps y adapta su comportamiento:

```typescript
@VoltrixMcpServer({
  name: "adaptive-server",
  version: "1.0.0",
  // Configuración automática según el cliente
  adaptiveConfig: {
    chatgpt: {
      // Configuración específica para ChatGPT Apps
      maxTokens: 4000,
      streaming: true,
      rateLimiting: { requests: 100, window: "1m" }
    },
    claude: {
      // Configuración para Claude
      maxTokens: 8000,
      streaming: false
    },
    default: {
      // Configuración por defecto
      maxTokens: 2000,
      streaming: false
    }
  }
})
export class AdaptiveServer {
  
  @McpTool({
    name: "analyze_data",
    description: "Analyze data with client-specific optimizations",
    inputSchema: {
      type: "object",
      properties: {
        data: { type: "string" },
        format: { type: "string", enum: ["json", "csv", "xml"] }
      },
      required: ["data"]
    }
  })
  async analyzeData(
    @McpArgs() args: { data: string; format?: string },
    @McpContext() context: McpRequestContext
  ) {
    // Adapta la respuesta según el cliente
    if (context.clientInfo.isChatGpt) {
      return this.formatForChatGpt(args.data, args.format);
    }
    
    return this.formatDefault(args.data, args.format);
  }

  private formatForChatGpt(data: string, format?: string) {
    // Formato optimizado para ChatGPT Apps
    return {
      content: [{
        type: "text",
        text: this.generateChatGptOptimizedResponse(data, format)
      }],
      metadata: {
        clientOptimized: true,
        format: "chatgpt",
        tokens: this.estimateTokens(data)
      }
    };
  }
}
```

### Manifest Auto-Generation
```typescript
// El manifest se genera automáticamente basado en los decoradores
@VoltrixMcpServer({
  name: "smart-assistant",
  chatgpt: {
    enabled: true,
    // Manifest se genera automáticamente, pero se puede personalizar
    customManifest: {
      name: "Smart Assistant for ChatGPT",
      description: "Advanced AI assistant with specialized tools",
      ui: {
        welcome_message: "Hello! I'm your smart assistant. I can help with data analysis, file operations, and more.",
        categories: ["productivity", "analysis", "automation"],
        suggested_prompts: [
          "Analyze this spreadsheet data",
          "Create a backup of important files",
          "Generate a summary report"
        ]
      }
    }
  }
})
export class SmartAssistant {
  // Los decorators automáticamente se incluyen en el manifest
}
```

### Typed Options with JSON Schema Validation
```typescript
interface AnalysisOptions {
  algorithm?: 'standard' | 'advanced' | 'ml';
  includeCharts?: boolean;
  outputFormat?: 'text' | 'markdown' | 'html';
  language?: 'en' | 'es' | 'fr';
}

@McpResource({
  uri: "analysis://data/*",
  name: "Data Analysis",
  description: "Perform data analysis with customizable options",
  // Schema JSON automáticamente validado
  optionsSchema: {
    type: "object",
    properties: {
      algorithm: {
        type: "string",
        enum: ["standard", "advanced", "ml"],
        default: "standard",
        description: "Analysis algorithm to use"
      },
      includeCharts: {
        type: "boolean",
        default: false,
        description: "Include visual charts in the analysis"
      },
      outputFormat: {
        type: "string",
        enum: ["text", "markdown", "html"],
        default: "markdown",
        description: "Format for the analysis output"
      },
      language: {
        type: "string",
        enum: ["en", "es", "fr"],
        default: "en",
        description: "Language for the analysis report"
      }
    }
  },
  // Metadatos para ChatGPT Apps
  chatgpt: {
    category: "analysis",
    previewable: true, // Permite preview en ChatGPT
    cacheable: true,   // Permite cache en ChatGPT
    maxCacheTime: 3600 // Cache por 1 hora
  }
})
async analyzeData(
  @McpParams() params: { dataId: string },
  @McpOptions() options: AnalysisOptions = {},
  @ChatGptClient() chatgptContext?: ChatGptClientContext
) {
  // Opciones completamente tipadas y validadas
  const {
    algorithm = 'standard',
    includeCharts = false,
    outputFormat = 'markdown',
    language = 'en'
  } = options;

  // Contexto específico de ChatGPT si está disponible
  if (chatgptContext) {
    return this.generateChatGptOptimizedAnalysis(
      params.dataId,
      { algorithm, includeCharts, outputFormat, language },
      chatgptContext
    );
  }

  return this.generateStandardAnalysis(params.dataId, options);
}
```

## Best Practices

### Typed Options Guidelines
1. **Define Clear Interfaces** - Crear interfaces TypeScript específicas para cada conjunto de opciones
2. **Use JSON Schema** - Proporcionar schemas JSON completos para validación automática
3. **Provide Defaults** - Siempre incluir valores por defecto sensatos
4. **Document Parameters** - Usar descripciones claras en los schemas para ChatGPT
5. **Validate at Runtime** - Implementar validación adicional cuando sea necesario

### ChatGPT Apps Optimization
1. **Optimize for Token Limits** - Mantener respuestas dentro de límites de tokens
2. **Use Markdown Format** - Preferir Markdown para mejor renderizado en ChatGPT
3. **Include Progress Updates** - Usar reportes de progreso para operaciones largas
4. **Provide Clear Categories** - Organizar tools y prompts en categorías lógicas
5. **Handle Errors Gracefully** - Proporcionar mensajes de error útiles y accionables

### Type Safety Guidelines
```typescript
// ✅ Buena práctica: Interfaces bien definidas
interface DatabaseQueryOptions {
  limit?: number;
  offset?: number;
  sort?: {
    field: string;
    direction: 'asc' | 'desc';
  };
  filters?: {
    [key: string]: any;
  };
}

// ✅ Buena práctica: Schema JSON completo
const queryOptionsSchema = {
  type: "object",
  properties: {
    limit: { 
      type: "number", 
      minimum: 1, 
      maximum: 1000, 
      default: 100,
      description: "Maximum number of records to return"
    },
    offset: { 
      type: "number", 
      minimum: 0, 
      default: 0,
      description: "Number of records to skip"
    },
    sort: {
      type: "object",
      properties: {
        field: { type: "string", description: "Field to sort by" },
        direction: { 
          type: "string", 
          enum: ["asc", "desc"], 
          default: "asc",
          description: "Sort direction"
        }
      },
      required: ["field"]
    },
    filters: {
      type: "object",
      additionalProperties: true,
      description: "Key-value pairs for filtering results"
    }
  }
} as const;

// ❌ Mala práctica: Opciones no tipadas
async badExample(@McpParams() params: any, options?: any) {
  // Sin tipos, sin validación, difícil de usar
}

// ✅ Buena práctica: Completamente tipado
async goodExample(
  @McpParams() params: { table: string },
  @McpOptions() options: DatabaseQueryOptions = {}
) {
  // Tipos seguros, validación automática, IntelliSense completo
}
```

### Performance Guidelines
1. **Minimize Resource Queries** - Use efficient database queries
2. **Cache Expensive Operations** - Cache computation results
3. **Use Streaming** - Stream large data responses for ChatGPT Apps
4. **Batch Operations** - Group multiple operations when possible
5. **Implement Progress Reporting** - For long operations in ChatGPT

### Security Guidelines
1. **Validate All Inputs** - Never trust external data
2. **Use Least Privilege** - Minimal required permissions
3. **Log Security Events** - Audit all access attempts
4. **Regular Updates** - Keep dependencies updated

### Development Guidelines
1. **Type Everything** - Use TypeScript types extensively
2. **Test with Real Clients** - Use actual MCP clients for testing
3. **Document APIs** - Provide clear API documentation
4. **Monitor Performance** - Track resource usage and response times

## Future Roadmap

### Planned Features
- **Advanced Type Inference** - Automatic TypeScript type generation from JSON schemas
- **GraphQL Integration** - Native GraphQL resource support with typed resolvers
- **WebSocket Transport** - Real-time MCP connections with typed event streams
- **Plugin System** - Extensible plugin architecture with typed configurations
- **Advanced Caching** - Distributed caching support with typed cache keys
- **Metrics Dashboard** - Built-in monitoring UI with ChatGPT Apps integration
- **Multi-Client Optimization** - Automatic response formatting per AI client
- **Schema Evolution** - Automatic schema versioning and migration

### ChatGPT Apps Enhancements
- **Visual Components** - Support for charts, tables, and interactive elements
- **Streaming Responses** - Real-time response streaming for long operations
- **Context Persistence** - Maintain context across ChatGPT conversations
- **Custom UI Elements** - Rich UI components specific to ChatGPT interface
- **Voice Integration** - Support for voice commands and responses

### Performance Targets
- **Sub-millisecond Latency** - <1ms response times for cached resources
- **High Throughput** - 10k+ requests/second per server
- **Low Memory Usage** - <50MB base memory footprint
- **Fast Startup** - <100ms server startup time
- **ChatGPT Optimized** - <500ms response time for ChatGPT Apps
- **Type Safety** - 100% TypeScript coverage with strict mode