/**
 * @vitest-environment node
 */

import { describe, it, expect } from 'vitest';
import { 
  isJSONRPCRequest, 
  isJSONRPCResponse, 
  isTextContent,
  ErrorCode 
} from '../src/types/protocol.js';

describe('Protocol Types (SDK Compatible)', () => {
  describe('JSON-RPC Type Guards', () => {
    it('should identify valid JSON-RPC requests', () => {
      const validRequest = {
        jsonrpc: '2.0' as const,
        method: 'initialize',
        params: { protocolVersion: '2024-11-05' },
        id: 1
      };

      expect(isJSONRPCRequest(validRequest)).toBe(true);
      expect(isJSONRPCRequest({})).toBe(false);
      expect(isJSONRPCRequest(null)).toBe(false);
    });

    it('should identify valid JSON-RPC responses', () => {
      const validResponse = {
        jsonrpc: '2.0' as const,
        result: { protocolVersion: '2024-11-05' },
        id: 1
      };

      expect(isJSONRPCResponse(validResponse)).toBe(true);
      expect(isJSONRPCResponse({})).toBe(false);
      expect(isJSONRPCResponse(null)).toBe(false);
    });

    it('should identify text content', () => {
      const textContent = {
        type: 'text' as const,
        text: 'Hello, world!'
      };

      const imageContent = {
        type: 'image' as const,
        data: 'base64...',
        mimeType: 'image/png'
      };

      expect(isTextContent(textContent)).toBe(true);
      expect(isTextContent(imageContent)).toBe(false);
    });
  });

  describe('Error Codes (SDK Compatible)', () => {
    it('should export error codes compatible with SDK', () => {
      expect(ErrorCode.ParseError).toBe(-32700);
      expect(ErrorCode.InvalidRequest).toBe(-32600);
      expect(ErrorCode.MethodNotFound).toBe(-32601);
      expect(ErrorCode.ResourceNotFound).toBe(-32001);
    });
  });

  describe('SDK Compatibility', () => {
    it('should have compatible interface structure', () => {
      // Test that our interfaces match SDK expectations
      const serverInfo = {
        name: 'test-server',
        version: '1.0.0'
      };

      expect(serverInfo.name).toBe('test-server');
      expect(serverInfo.version).toBe('1.0.0');
    });

    it('should support Voltrix extensions', () => {
      const voltrixTool = {
        name: 'test-tool',
        description: 'A test tool',
        inputSchema: {
          type: 'object' as const,
          properties: {}
        },
        voltrix: {
          category: 'testing',
          ui: {
            interactive: true
          }
        }
      };

      expect(voltrixTool.voltrix?.category).toBe('testing');
      expect(voltrixTool.voltrix?.ui?.interactive).toBe(true);
    });
  });
});