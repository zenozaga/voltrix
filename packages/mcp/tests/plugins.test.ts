/**
 * @vitest-environment node
 */

import { describe, it, expect } from 'vitest';
import { 
  isPlugin, 
  isPluginConfiguration, 
  isPluginHealthy 
} from '../src/types/plugin.js';

describe('Plugin Types', () => {
  describe('Plugin Type Guards', () => {
    it('should identify valid plugins', () => {
      const validPlugin = {
        id: 'test-plugin',
        name: 'Test Plugin',
        version: '1.0.0'
      };

      expect(isPlugin(validPlugin)).toBe(true);
      expect(isPlugin({})).toBe(false);
      expect(isPlugin(null)).toBe(false);
    });

    it('should identify plugin configurations', () => {
      const validConfig = {
        id: 'custom-id',
        enabled: true,
        priority: 10
      };

      expect(isPluginConfiguration(validConfig)).toBe(true);
      expect(isPluginConfiguration({})).toBe(true); // Empty object is valid
      expect(isPluginConfiguration(null)).toBe(false);
    });

    it('should identify healthy plugins', () => {
      const healthyStatus = {
        healthy: true,
        status: 'healthy' as const,
        checkedAt: new Date()
      };

      const unhealthyStatus = {
        healthy: false,
        status: 'unhealthy' as const,
        checkedAt: new Date()
      };

      expect(isPluginHealthy(healthyStatus)).toBe(true);
      expect(isPluginHealthy(unhealthyStatus)).toBe(false);
    });
  });
});