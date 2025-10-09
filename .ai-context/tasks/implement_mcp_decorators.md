# Task 6: Implement MCP Server with Decorators

## Objective
Complete the implementation of the MCP server architecture using TypeScript decorators for creating flexible and type-safe MCP servers.

## Prerequisites
- Understanding of TypeScript decorators
- Knowledge of MCP (Model Context Protocol)
- Familiarity with the project architecture in `ARCHITECTURE.md`

## Implementation Status
✅ **Completed:**
- Core decorator system (@MCPServer, @MCPTool, @MCPResource, @MCPPrompt)
- Internal registry system for servers and methods
- Server builder and runner classes
- Custom reflection utilities (no external dependencies)
- Type definitions and validation utilities
- Basic example server implementation

## Next Steps to Complete

### 1. Fix TypeScript Decorator Issues
**Current Problem:** Decorator signature mismatch
**Solution:** Update decorators to return proper types

```typescript
// In tool.decorator.ts, resource.decorator.ts, prompt.decorator.ts
export function MCPTool(config: MCPToolConfig) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor): PropertyDescriptor | void {
    // Implementation
    return descriptor; // Ensure we return the descriptor
  };
}
```

### 2. Integrate with Official MCP SDK
**Task:** Connect with `@modelcontextprotocol/sdk`
- Install official MCP SDK package
- Implement proper transport layer integration
- Handle MCP protocol messages correctly
- Add proper initialization and capability negotiation

### 3. Enhanced Server Builder
**Improvements needed:**
- Better error handling and validation
- Support for middleware functions  
- Automatic method discovery and registration
- Configuration validation and defaults

### 4. Testing Framework
**Create comprehensive tests:**
- Unit tests for decorators
- Integration tests for server functionality
- Mock MCP client for testing
- Performance benchmarks

### 5. Advanced Features
**Additional functionality:**
- Dependency injection system
- Configuration providers
- Plugin architecture
- Auto-generated documentation

## Detailed Implementation Guide

### Step 1: Fix Decorator Return Types
```typescript
// Update each decorator file to properly handle TypeScript strict mode
export function MCPTool(config: MCPToolConfig) {
  return function <T extends (...args: any[]) => any>(
    target: any, 
    propertyKey: string, 
    descriptor: TypedPropertyDescriptor<T>
  ): TypedPropertyDescriptor<T> | void {
    // Store metadata
    ReflectionUtils.setMetadata(MetadataKeys.TOOL_METHOD, config, target, propertyKey);
    
    // Register method
    MethodRegistry.registerTool(target.constructor, propertyKey, config);
    
    // Enhance method with error handling
    const originalMethod = descriptor.value;
    if (originalMethod) {
      descriptor.value = async function (...args: any[]) {
        try {
          const result = await originalMethod.apply(this, args);
          return result;
        } catch (error) {
          throw new Error(`Tool '${config.name}' failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      } as T;
    }
    
    return descriptor;
  };
}
```

### Step 2: MCP Protocol Integration
```typescript
// Add to server-runner.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

class MCPServerRunner {
  private mcpServer?: Server;
  
  async start(): Promise<void> {
    const config = this.builder.getConfig();
    
    // Create MCP Server instance
    this.mcpServer = new Server(
      { name: config.name, version: config.version },
      { capabilities: this.builder.getCapabilities() }
    );
    
    // Register handlers
    this.registerHandlers();
    
    // Set up transport
    const transport = new StdioServerTransport();
    await this.mcpServer.connect(transport);
  }
  
  private registerHandlers(): void {
    if (!this.mcpServer) return;
    
    // Register tool handlers
    const tools = this.builder.getTools();
    for (const tool of tools) {
      this.mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
        if (request.params.name === tool.name) {
          return await this.builder.callTool(tool.name, request.params.arguments);
        }
      });
    }
    
    // Register resource handlers
    // Register prompt handlers
  }
}
```

### Step 3: Enhanced Validation
```typescript
// Add to validation.ts
export class MCPValidation {
  static validateServerConfig(config: MCPServerConfig): void {
    if (!config.name || typeof config.name !== 'string') {
      throw new Error('Server name is required and must be a string');
    }
    
    if (!config.version || typeof config.version !== 'string') {
      throw new Error('Server version is required and must be a string');
    }
    
    // Validate semver format
    if (!/^\d+\.\d+\.\d+/.test(config.version)) {
      throw new Error('Server version must follow semver format (x.y.z)');
    }
  }
  
  static validateToolConfig(config: MCPToolConfig): void {
    if (!config.name || typeof config.name !== 'string') {
      throw new Error('Tool name is required and must be a string');
    }
    
    if (config.inputSchema) {
      const validation = ValidationUtils.validateSchema({}, config.inputSchema);
      // Additional schema validation
    }
  }
}
```

### Step 4: Example Usage Patterns
```typescript
// Advanced server example
@MCPServer({
  name: 'advanced-server',
  version: '2.0.0',
  capabilities: {
    tools: true,
    resources: true,
    prompts: true
  }
})
class AdvancedServer {
  
  @MCPTool({
    name: 'process_data',
    description: 'Process data with validation',
    inputSchema: {
      type: 'object',
      properties: {
        data: { type: 'array', items: { type: 'object' } },
        options: { 
          type: 'object',
          properties: {
            format: { type: 'string', enum: ['json', 'csv', 'xml'] }
          }
        }
      },
      required: ['data']
    }
  })
  async processData(args: {
    data: Record<string, any>[];
    options?: { format?: 'json' | 'csv' | 'xml' };
  }) {
    // Process with proper error handling
    const format = args.options?.format || 'json';
    
    try {
      const processed = args.data.map(item => ({
        ...item,
        processed: true,
        timestamp: Date.now()
      }));
      
      return {
        success: true,
        format,
        data: processed,
        count: processed.length
      };
    } catch (error) {
      throw new Error(`Data processing failed: ${error}`);
    }
  }
}
```

## Success Criteria
- [ ] All TypeScript compilation errors resolved
- [ ] Decorators work correctly with strict TypeScript
- [ ] MCP protocol integration functional
- [ ] Example server runs without errors
- [ ] Basic test suite passes
- [ ] Documentation updated with examples

## Expected Deliverables
1. **Fixed decorator implementations** with proper TypeScript support
2. **Working MCP protocol integration** using official SDK
3. **Enhanced validation system** for configurations and inputs
4. **Comprehensive example** demonstrating all features
5. **Test suite** covering core functionality
6. **Updated documentation** with API reference

## Timeline Estimate
- **Phase 1** (TypeScript fixes): 1-2 days
- **Phase 2** (MCP integration): 2-3 days  
- **Phase 3** (Testing & docs): 1-2 days
- **Total**: 4-7 days

## Dependencies
- `@modelcontextprotocol/sdk`: Official MCP SDK
- `@types/node`: Node.js type definitions
- `jest`: Testing framework
- `typescript`: TypeScript compiler

This task will complete the core MCP server implementation and make it production-ready for creating flexible MCP servers with decorators.