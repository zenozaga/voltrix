# MCP Server Template

This template provides a starting point for creating MCP servers using the Voltrix framework with TypeScript decorators.

## Basic MCP Server Template

```typescript
import { 
  VoltrixMcpServer, 
  McpResource, 
  McpTool, 
  McpPrompt,
  McpParams,
  McpArg,
  PromptArg,
  McpContext,
  ResourceParams,
  ToolResult,
  PromptTemplate,
  McpRequestContext
} from '@voltrix/mcp';

/**
 * ${SERVER_NAME} - ${SERVER_DESCRIPTION}
 * 
 * This MCP server provides ${SERVER_FUNCTIONALITY}
 * 
 * @author ${AUTHOR}
 * @version ${VERSION}
 * @since ${DATE}
 */
@VoltrixMcpServer({
  name: "${SERVER_NAME}",
  version: "${VERSION}",
  description: "${SERVER_DESCRIPTION}",
  transport: ["websocket", "stdio"],
  authentication: {
    type: "bearer",
    required: ${REQUIRE_AUTH}
  },
  capabilities: {
    resources: {
      subscribe: true,
      listChanged: true
    },
    tools: {},
    prompts: {
      listChanged: true
    },
    sampling: {}
  }
})
export class ${CLASS_NAME} {
  
  /**
   * Constructor for ${CLASS_NAME}
   * 
   * @param logger - Logger service for debugging and monitoring
   * @param config - Configuration service for server settings
   */
  constructor(
    private readonly logger: Logger,
    private readonly config: ConfigService
  ) {
    this.logger.info('${CLASS_NAME} initialized', { 
      name: "${SERVER_NAME}",
      version: "${VERSION}"
    });
  }

  /**
   * ${RESOURCE_NAME} resource endpoint
   * 
   * Provides access to ${RESOURCE_DESCRIPTION}
   * 
   * @param params - Resource parameters including URI and range
   * @param context - Request context with authentication and metadata
   * @returns Array of resource contents
   */
  @McpResource({
    uri: "${RESOURCE_URI}",
    name: "${RESOURCE_NAME}",
    description: "${RESOURCE_DESCRIPTION}",
    mimeType: "${RESOURCE_MIME_TYPE}",
    permissions: ["read"],
    cache: {
      ttl: 300, // 5 minutes
      maxSize: 1000
    },
    authentication: {
      required: ${RESOURCE_AUTH_REQUIRED},
      roles: ["user", "admin"]
    }
  })
  async ${RESOURCE_METHOD_NAME}(
    @McpParams() params: ResourceParams,
    @McpContext() context: McpRequestContext
  ): Promise<ResourceContent[]> {
    try {
      this.logger.debug('Reading ${RESOURCE_NAME}', { 
        uri: params.uri,
        user: context.user?.id 
      });

      // Validate user permissions
      if (${RESOURCE_AUTH_REQUIRED} && !context.user) {
        throw new McpError(
          McpErrorCode.AUTHENTICATION_FAILED,
          'Authentication required for this resource'
        );
      }

      // Extract URI parameters
      const resourcePath = this.extractResourcePath(params.uri);
      
      // Validate resource path
      this.validateResourcePath(resourcePath);
      
      // Read resource content
      const content = await this.readResourceContent(resourcePath, params.range);
      
      return [{
        uri: params.uri,
        mimeType: "${RESOURCE_MIME_TYPE}",
        text: content
      }];
      
    } catch (error) {
      this.logger.error('Error reading ${RESOURCE_NAME}', { 
        error: error.message,
        uri: params.uri
      });
      throw error;
    }
  }

  /**
   * ${TOOL_NAME} tool implementation
   * 
   * ${TOOL_DESCRIPTION}
   * 
   * @param ${TOOL_ARG1_NAME} - ${TOOL_ARG1_DESCRIPTION}
   * @param ${TOOL_ARG2_NAME} - ${TOOL_ARG2_DESCRIPTION}
   * @param context - Request context with authentication and metadata
   * @returns Tool execution result
   */
  @McpTool({
    name: "${TOOL_NAME}",
    description: "${TOOL_DESCRIPTION}",
    inputSchema: {
      type: "object",
      properties: {
        ${TOOL_ARG1_NAME}: {
          type: "${TOOL_ARG1_TYPE}",
          description: "${TOOL_ARG1_DESCRIPTION}"
        },
        ${TOOL_ARG2_NAME}: {
          type: "${TOOL_ARG2_TYPE}",
          description: "${TOOL_ARG2_DESCRIPTION}"
        }
      },
      required: ["${TOOL_ARG1_NAME}"]
    },
    outputSchema: {
      type: "object",
      properties: {
        success: { type: "boolean" },
        result: { type: "string" },
        metadata: { type: "object" }
      }
    },
    timeout: 10000,
    permissions: ["${TOOL_PERMISSION}"],
    retries: 3
  })
  async ${TOOL_METHOD_NAME}(
    @McpArg("${TOOL_ARG1_NAME}") ${TOOL_ARG1_NAME}: ${TOOL_ARG1_TS_TYPE},
    @McpArg("${TOOL_ARG2_NAME}") ${TOOL_ARG2_NAME}: ${TOOL_ARG2_TS_TYPE} = ${TOOL_ARG2_DEFAULT},
    @McpContext() context: McpRequestContext
  ): Promise<ToolResult> {
    try {
      this.logger.debug('Executing ${TOOL_NAME}', { 
        ${TOOL_ARG1_NAME},
        ${TOOL_ARG2_NAME},
        user: context.user?.id 
      });

      // Validate permissions
      if (!this.hasPermission(context.user, "${TOOL_PERMISSION}")) {
        throw new McpError(
          McpErrorCode.ACCESS_DENIED,
          'Insufficient permissions for this tool'
        );
      }

      // Validate input parameters
      this.validateToolInput({ ${TOOL_ARG1_NAME}, ${TOOL_ARG2_NAME} });
      
      // Execute tool logic
      const result = await this.executeToolLogic(${TOOL_ARG1_NAME}, ${TOOL_ARG2_NAME});
      
      this.logger.info('${TOOL_NAME} executed successfully', { 
        ${TOOL_ARG1_NAME},
        result: result.length
      });

      return {
        content: [{
          type: "text",
          text: `${TOOL_NAME} completed successfully: ${result}`
        }],
        isError: false
      };
      
    } catch (error) {
      this.logger.error('Error executing ${TOOL_NAME}', { 
        error: error.message,
        ${TOOL_ARG1_NAME}
      });
      
      return {
        content: [{
          type: "text",
          text: `Error executing ${TOOL_NAME}: ${error.message}`
        }],
        isError: true
      };
    }
  }

  /**
   * ${PROMPT_NAME} prompt template
   * 
   * ${PROMPT_DESCRIPTION}
   * 
   * @param ${PROMPT_ARG1_NAME} - ${PROMPT_ARG1_DESCRIPTION}
   * @param ${PROMPT_ARG2_NAME} - ${PROMPT_ARG2_DESCRIPTION}
   * @returns Formatted prompt template
   */
  @McpPrompt({
    name: "${PROMPT_NAME}",
    description: "${PROMPT_DESCRIPTION}",
    arguments: [
      {
        name: "${PROMPT_ARG1_NAME}",
        description: "${PROMPT_ARG1_DESCRIPTION}",
        type: "${PROMPT_ARG1_TYPE}",
        required: true
      },
      {
        name: "${PROMPT_ARG2_NAME}",
        description: "${PROMPT_ARG2_DESCRIPTION}",
        type: "${PROMPT_ARG2_TYPE}",
        required: false,
        default: ${PROMPT_ARG2_DEFAULT}
      }
    ]
  })
  ${PROMPT_METHOD_NAME}(
    @PromptArg("${PROMPT_ARG1_NAME}") ${PROMPT_ARG1_NAME}: ${PROMPT_ARG1_TS_TYPE},
    @PromptArg("${PROMPT_ARG2_NAME}") ${PROMPT_ARG2_NAME}: ${PROMPT_ARG2_TS_TYPE} = ${PROMPT_ARG2_DEFAULT}
  ): PromptTemplate {
    return {
      messages: [
        {
          role: "system",
          content: {
            type: "text",
            text: "${PROMPT_SYSTEM_MESSAGE}"
          }
        },
        {
          role: "user",
          content: {
            type: "text",
            text: `${PROMPT_USER_MESSAGE_TEMPLATE}`
          }
        }
      ]
    };
  }

  // Private helper methods

  /**
   * Extract resource path from URI
   */
  private extractResourcePath(uri: string): string {
    const match = uri.match(/^${RESOURCE_URI_PATTERN}$/);
    if (!match) {
      throw new McpError(
        McpErrorCode.INVALID_PARAMS,
        `Invalid resource URI: ${uri}`
      );
    }
    return match[1] || '';
  }

  /**
   * Validate resource path for security
   */
  private validateResourcePath(path: string): void {
    // Prevent path traversal attacks
    if (path.includes('..') || path.includes('\0')) {
      throw new McpError(
        McpErrorCode.INVALID_PARAMS,
        'Invalid resource path'
      );
    }
    
    // Add additional validation as needed
  }

  /**
   * Read resource content with range support
   */
  private async readResourceContent(
    path: string, 
    range?: { start: number; end: number }
  ): Promise<string> {
    // Implementation depends on resource type
    // This is a placeholder - implement according to your needs
    
    const content = await this.loadResourceContent(path);
    
    if (range) {
      return content.slice(range.start, range.end);
    }
    
    return content;
  }

  /**
   * Load resource content from storage
   */
  private async loadResourceContent(path: string): Promise<string> {
    // Implement according to your resource type:
    // - File system access
    // - Database queries
    // - API calls
    // - Memory cache
    
    throw new Error('loadResourceContent not implemented');
  }

  /**
   * Validate tool input parameters
   */
  private validateToolInput(input: any): void {
    // Add custom validation logic
    if (!input.${TOOL_ARG1_NAME}) {
      throw new McpError(
        McpErrorCode.INVALID_PARAMS,
        '${TOOL_ARG1_NAME} is required'
      );
    }
  }

  /**
   * Execute the main tool logic
   */
  private async executeToolLogic(
    ${TOOL_ARG1_NAME}: ${TOOL_ARG1_TS_TYPE},
    ${TOOL_ARG2_NAME}: ${TOOL_ARG2_TS_TYPE}
  ): Promise<string> {
    // Implement your tool logic here
    // This is a placeholder - implement according to your needs
    
    return `Processed ${${TOOL_ARG1_NAME}} with ${${TOOL_ARG2_NAME}}`;
  }

  /**
   * Check user permissions
   */
  private hasPermission(user: any, permission: string): boolean {
    if (!user) return false;
    return user.permissions?.includes(permission) || user.roles?.includes('admin');
  }
}
```

## Template Variables

When using this template, replace the following variables:

### Server Configuration
- `${SERVER_NAME}` - Name of your MCP server (e.g., "file-server")
- `${SERVER_DESCRIPTION}` - Description of server functionality
- `${SERVER_FUNCTIONALITY}` - What the server does
- `${CLASS_NAME}` - TypeScript class name (e.g., "FileServer")
- `${AUTHOR}` - Author name
- `${VERSION}` - Server version (e.g., "1.0.0")
- `${DATE}` - Current date
- `${REQUIRE_AUTH}` - Whether authentication is required (true/false)

### Resource Configuration
- `${RESOURCE_NAME}` - Human-readable resource name
- `${RESOURCE_DESCRIPTION}` - Resource description
- `${RESOURCE_URI}` - Resource URI pattern (e.g., "file://docs/*")
- `${RESOURCE_URI_PATTERN}` - Regex pattern for URI matching
- `${RESOURCE_MIME_TYPE}` - MIME type (e.g., "text/plain")
- `${RESOURCE_METHOD_NAME}` - Method name (e.g., "getDocuments")
- `${RESOURCE_AUTH_REQUIRED}` - Whether resource requires auth (true/false)

### Tool Configuration
- `${TOOL_NAME}` - Tool name (e.g., "create_file")
- `${TOOL_DESCRIPTION}` - Tool description
- `${TOOL_METHOD_NAME}` - Method name (e.g., "createFile")
- `${TOOL_PERMISSION}` - Required permission (e.g., "file:write")
- `${TOOL_ARG1_NAME}` - First argument name
- `${TOOL_ARG1_DESCRIPTION}` - First argument description
- `${TOOL_ARG1_TYPE}` - JSON Schema type
- `${TOOL_ARG1_TS_TYPE}` - TypeScript type
- `${TOOL_ARG2_NAME}` - Second argument name
- `${TOOL_ARG2_DESCRIPTION}` - Second argument description
- `${TOOL_ARG2_TYPE}` - JSON Schema type
- `${TOOL_ARG2_TS_TYPE}` - TypeScript type
- `${TOOL_ARG2_DEFAULT}` - Default value

### Prompt Configuration
- `${PROMPT_NAME}` - Prompt name (e.g., "user_summary")
- `${PROMPT_DESCRIPTION}` - Prompt description
- `${PROMPT_METHOD_NAME}` - Method name (e.g., "getUserSummary")
- `${PROMPT_ARG1_NAME}` - First argument name
- `${PROMPT_ARG1_DESCRIPTION}` - First argument description
- `${PROMPT_ARG1_TYPE}` - Argument type
- `${PROMPT_ARG1_TS_TYPE}` - TypeScript type
- `${PROMPT_ARG2_NAME}` - Second argument name
- `${PROMPT_ARG2_DESCRIPTION}` - Second argument description
- `${PROMPT_ARG2_TYPE}` - Argument type
- `${PROMPT_ARG2_TS_TYPE}` - TypeScript type
- `${PROMPT_ARG2_DEFAULT}` - Default value
- `${PROMPT_SYSTEM_MESSAGE}` - System prompt message
- `${PROMPT_USER_MESSAGE_TEMPLATE}` - User message template

## Usage Example

```bash
# Create a new MCP server file
cp mcp-server-template.md my-file-server.ts

# Replace template variables
sed -i 's/${SERVER_NAME}/file-server/g' my-file-server.ts
sed -i 's/${CLASS_NAME}/FileServer/g' my-file-server.ts
# ... continue with other variables
```

## Next Steps

1. Replace all template variables with your specific values
2. Implement the placeholder methods according to your needs
3. Add additional resources, tools, and prompts as required
4. Write comprehensive tests for your MCP server
5. Add proper error handling and logging
6. Document your server's capabilities and usage