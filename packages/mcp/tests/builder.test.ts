/**
 * @vitest-environment node
 */

import { describe, it, expect } from 'vitest';
import { 
  isQuickConfig, 
  isPresetName, 
  isBuilderExtension 
} from '../src/builder/interfaces.js';

describe('Builder Types', () => {
  describe('Builder Type Guards', () => {
    it('should identify valid quick configs', () => {
      const validConfig = {
        name: 'test-server',
        version: '1.0.0',
        description: 'Test MCP server'
      };

      expect(isQuickConfig(validConfig)).toBe(true);
      expect(isQuickConfig({})).toBe(false);
      expect(isQuickConfig(null)).toBe(false);
    });

    it('should identify valid preset names', () => {
      expect(isPresetName('chatgpt')).toBe(true);
      expect(isPresetName('enterprise')).toBe(true);
      expect(isPresetName('development')).toBe(true);
      expect(isPresetName('minimal')).toBe(true);
      expect(isPresetName('invalid')).toBe(false);
    });

    it('should identify builder extensions', () => {
      const validExtension = {
        name: 'test-extension',
        version: '1.0.0',
        extendBuilder: () => ({} as any),
        extendConfiguration: (config: any) => config
      };

      expect(isBuilderExtension(validExtension)).toBe(true);
      expect(isBuilderExtension({})).toBe(false);
      expect(isBuilderExtension(null)).toBe(false);
    });
  });
});