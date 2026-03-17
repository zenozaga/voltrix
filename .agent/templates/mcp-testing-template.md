# MCP Testing Utilities Template

This template provides testing utilities and patterns for MCP servers built with the Voltrix framework.

## Test Utilities Template

```typescript
import { 
  VoltrixMcpServer,
  McpResource,
  McpTool,
  McpPrompt,
  McpTestClient,
  createMcpTestServer,
  createMcpTestClient
} from '@voltrix/mcp';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * Test utilities for ${SERVER_NAME}
 * 
 * Provides comprehensive testing setup for MCP server testing
 */

// Test server class for integration testing
@VoltrixMcpServer({
  name: "${TEST_SERVER_NAME}",
  version: "1.0.0-test",
  transport: ["websocket"],
  authentication: { type: "none", required: false }
})
export class ${TEST_CLASS_NAME} {
  
  @McpResource({
    uri: "test://resource/*",
    name: "Test Resource"
  })
  async getTestResource(@McpParams() params: ResourceParams) {
    return [{
      uri: params.uri,
      mimeType: "text/plain",
      text: "Test content"
    }];
  }
  
  @McpTool({
    name: "test_tool",
    description: "Test tool for validation",
    inputSchema: {
      type: "object",
      properties: {
        input: { type: "string" }
      },
      required: ["input"]
    }
  })
  async testTool(@McpArg("input") input: string) {
    return {
      content: [{
        type: "text",
        text: `Processed: ${input}`
      }],
      isError: false
    };
  }
  
  @McpPrompt({
    name: "test_prompt",
    description: "Test prompt template"
  })
  testPrompt(@PromptArg("query") query: string) {
    return {
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `Test query: ${query}`
        }
      }]
    };
  }
}

// Test suite for ${SERVER_NAME}
describe('${SERVER_NAME} MCP Server', () => {
  let server: McpTestServer;
  let client: McpTestClient;
  
  beforeEach(async () => {
    // Create test server instance
    server = await createMcpTestServer(${TEST_CLASS_NAME}, {
      timeout: 5000,
      debug: process.env.NODE_ENV === 'test'
    });
    
    // Create test client
    client = await createMcpTestClient(server.endpoint, {
      authentication: {
        type: "none"
      }
    });
    
    // Wait for connection
    await client.initialize();
  });
  
  afterEach(async () => {
    // Cleanup
    await client.disconnect();
    await server.shutdown();
  });

  describe('Server Initialization', () => {
    it('should initialize successfully', () => {
      expect(server.isRunning).toBe(true);
      expect(client.isConnected).toBe(true);
    });
    
    it('should have correct server info', async () => {
      const info = await client.getServerInfo();
      expect(info.name).toBe("${TEST_SERVER_NAME}");
      expect(info.version).toBe("1.0.0-test");
    });
    
    it('should report correct capabilities', async () => {
      const capabilities = await client.getCapabilities();
      expect(capabilities.resources).toBeDefined();
      expect(capabilities.tools).toBeDefined();
      expect(capabilities.prompts).toBeDefined();
    });
  });

  describe('Resource Operations', () => {
    it('should list available resources', async () => {
      const resources = await client.listResources();
      expect(resources.length).toBeGreaterThan(0);
      
      const testResource = resources.find(r => r.uri.startsWith("test://"));
      expect(testResource).toBeDefined();
      expect(testResource?.name).toBe("Test Resource");
    });
    
    it('should read resource content', async () => {
      const content = await client.readResource("test://resource/example");
      expect(content).toHaveLength(1);
      expect(content[0].mimeType).toBe("text/plain");
      expect(content[0].text).toBe("Test content");
    });
    
    it('should handle resource not found', async () => {
      await expect(client.readResource("test://nonexistent"))
        .rejects.toThrow(/not found/i);
    });
    
    it('should support resource range requests', async () => {
      const content = await client.readResource("test://resource/example", {
        range: { start: 0, end: 4 }
      });
      expect(content[0].text).toBe("Test");
    });
  });

  describe('Tool Operations', () => {
    it('should list available tools', async () => {
      const tools = await client.listTools();
      expect(tools.length).toBeGreaterThan(0);
      
      const testTool = tools.find(t => t.name === "test_tool");
      expect(testTool).toBeDefined();
      expect(testTool?.description).toBe("Test tool for validation");
    });
    
    it('should execute tools successfully', async () => {
      const result = await client.callTool("test_tool", {
        input: "hello world"
      });
      
      expect(result.isError).toBe(false);
      expect(result.content[0].text).toContain("Processed: hello world");
    });
    
    it('should validate tool arguments', async () => {
      await expect(client.callTool("test_tool", {}))
        .rejects.toThrow(/input.*required/i);
    });
    
    it('should handle tool errors gracefully', async () => {
      // Mock tool that throws error
      const mockServer = await createMcpTestServer(class {
        @McpTool({
          name: "error_tool",
          description: "Tool that throws errors"
        })
        async errorTool() {
          throw new Error("Test error");
        }
      });
      
      const mockClient = await createMcpTestClient(mockServer.endpoint);
      await mockClient.initialize();
      
      const result = await mockClient.callTool("error_tool", {});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Test error");
      
      await mockClient.disconnect();
      await mockServer.shutdown();
    });
  });

  describe('Prompt Operations', () => {
    it('should list available prompts', async () => {
      const prompts = await client.listPrompts();
      expect(prompts.length).toBeGreaterThan(0);
      
      const testPrompt = prompts.find(p => p.name === "test_prompt");
      expect(testPrompt).toBeDefined();
      expect(testPrompt?.description).toBe("Test prompt template");
    });
    
    it('should get prompt templates', async () => {
      const prompt = await client.getPrompt("test_prompt", {
        query: "test query"
      });
      
      expect(prompt.messages).toHaveLength(1);
      expect(prompt.messages[0].content.text).toContain("test query");
    });
    
    it('should validate prompt arguments', async () => {
      await expect(client.getPrompt("test_prompt", {}))
        .rejects.toThrow(/query.*required/i);
    });
  });

  describe('Performance Tests', () => {
    it('should handle concurrent requests', async () => {
      const concurrentRequests = 10;
      const promises = Array(concurrentRequests).fill(0).map((_, i) =>
        client.readResource(`test://resource/concurrent-${i}`)
      );
      
      const results = await Promise.all(promises);
      expect(results).toHaveLength(concurrentRequests);
      results.forEach(result => {
        expect(result[0].text).toBe("Test content");
      });
    });
    
    it('should handle large payloads', async () => {
      const largeInput = "x".repeat(10000);
      const result = await client.callTool("test_tool", {
        input: largeInput
      });
      
      expect(result.content[0].text).toContain(largeInput);
    }, 10000); // 10 second timeout
    
    it('should respond within performance limits', async () => {
      const startTime = Date.now();
      await client.readResource("test://resource/performance");
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(100); // <100ms
    });
  });

  describe('Authentication & Authorization', () => {
    let authServer: McpTestServer;
    let authClient: McpTestClient;
    
    beforeEach(async () => {
      @VoltrixMcpServer({
        name: "auth-test-server",
        version: "1.0.0",
        authentication: { type: "bearer", required: true }
      })
      class AuthTestServer {
        @McpResource({
          uri: "secure://data/*",
          name: "Secure Data",
          authentication: { required: true, roles: ["user"] }
        })
        async getSecureData(@McpContext() context: McpRequestContext) {
          return [{
            uri: "secure://data/test",
            text: `Accessed by: ${context.user?.id}`
          }];
        }
      }
      
      authServer = await createMcpTestServer(AuthTestServer);
      authClient = await createMcpTestClient(authServer.endpoint, {
        authentication: {
          type: "bearer",
          token: "test-token"
        }
      });
    });
    
    afterEach(async () => {
      await authClient.disconnect();
      await authServer.shutdown();
    });
    
    it('should require authentication', async () => {
      const noAuthClient = await createMcpTestClient(authServer.endpoint);
      await expect(noAuthClient.initialize())
        .rejects.toThrow(/authentication/i);
    });
    
    it('should allow authenticated requests', async () => {
      await authClient.initialize();
      const resources = await authClient.listResources();
      expect(resources.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid JSON-RPC requests', async () => {
      // Send malformed request
      await expect(client.sendRawMessage({ invalid: "request" }))
        .rejects.toThrow(/invalid.*request/i);
    });
    
    it('should handle connection drops', async () => {
      // Simulate connection drop
      await server.simulateConnectionDrop();
      
      // Client should detect disconnection
      expect(client.isConnected).toBe(false);
      
      // Should be able to reconnect
      await client.reconnect();
      expect(client.isConnected).toBe(true);
    });
    
    it('should handle server shutdown gracefully', async () => {
      const shutdownPromise = server.shutdown();
      
      // Should not hang
      await expect(shutdownPromise).resolves.toBeUndefined();
      
      // Client should detect shutdown
      expect(client.isConnected).toBe(false);
    });
  });
});

// Utility functions for testing
export class McpTestUtils {
  
  /**
   * Create a mock MCP resource response
   */
  static createMockResource(uri: string, content: string, mimeType = "text/plain") {
    return {
      uri,
      mimeType,
      text: content
    };
  }
  
  /**
   * Create a mock tool result
   */
  static createMockToolResult(text: string, isError = false) {
    return {
      content: [{
        type: "text" as const,
        text
      }],
      isError
    };
  }
  
  /**
   * Create a mock prompt template
   */
  static createMockPrompt(systemMessage: string, userMessage: string) {
    return {
      messages: [
        {
          role: "system" as const,
          content: {
            type: "text" as const,
            text: systemMessage
          }
        },
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: userMessage
          }
        }
      ]
    };
  }
  
  /**
   * Wait for a condition to be true (polling)
   */
  static async waitFor(
    condition: () => boolean | Promise<boolean>,
    timeout = 5000,
    interval = 100
  ): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      if (await condition()) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    
    throw new Error(`Condition not met within ${timeout}ms`);
  }
  
  /**
   * Create performance benchmark
   */
  static async benchmark<T>(
    operation: () => Promise<T>,
    iterations = 100
  ): Promise<{ avg: number; min: number; max: number; results: T[] }> {
    const times: number[] = [];
    const results: T[] = [];
    
    for (let i = 0; i < iterations; i++) {
      const start = Date.now();
      const result = await operation();
      const end = Date.now();
      
      times.push(end - start);
      results.push(result);
    }
    
    return {
      avg: times.reduce((a, b) => a + b, 0) / times.length,
      min: Math.min(...times),
      max: Math.max(...times),
      results
    };
  }
}

// Custom matchers for MCP testing
expect.extend({
  toBeValidMcpResource(received: any) {
    const pass = received &&
      typeof received.uri === 'string' &&
      (received.text || received.blob) &&
      typeof received.mimeType === 'string';
    
    return {
      pass,
      message: () => pass 
        ? `Expected ${received} not to be a valid MCP resource`
        : `Expected ${received} to be a valid MCP resource with uri, content, and mimeType`
    };
  },
  
  toBeValidToolResult(received: any) {
    const pass = received &&
      Array.isArray(received.content) &&
      typeof received.isError === 'boolean';
    
    return {
      pass,
      message: () => pass
        ? `Expected ${received} not to be a valid tool result`
        : `Expected ${received} to be a valid tool result with content array and isError boolean`
    };
  }
});

// Type extensions for custom matchers
declare module 'vitest' {
  interface Assertion<T = any> {
    toBeValidMcpResource(): T;
    toBeValidToolResult(): T;
  }
}
```

## Template Variables

Replace these variables when using the template:

- `${SERVER_NAME}` - Name of the server being tested
- `${TEST_SERVER_NAME}` - Name for the test server instance
- `${TEST_CLASS_NAME}` - TypeScript class name for test server

## Usage Example

```typescript
// Example test file: file-server.test.ts
import { FileServer } from '../src/file-server';
import { McpTestUtils } from './utils/mcp-test-utils';

describe('FileServer', () => {
  // Use the template patterns above
  // Replace ${SERVER_NAME} with "FileServer"
  // Replace ${TEST_CLASS_NAME} with "TestFileServer"
});
```

## Best Practices

1. **Isolation** - Each test should be independent
2. **Cleanup** - Always cleanup resources in afterEach
3. **Realistic Data** - Use realistic test data
4. **Error Testing** - Test both success and error cases
5. **Performance** - Include performance benchmarks
6. **Authentication** - Test auth scenarios when applicable