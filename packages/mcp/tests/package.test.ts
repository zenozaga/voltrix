/**
 * @vitest-environment node
 */

import { describe, it, expect } from 'vitest';

describe('@voltrix/mcp package structure', () => {
  it('should have valid package.json', async () => {
    const packageJson = await import('../package.json');
    
    expect(packageJson.name).toBe('@voltrix/mcp');
    expect(packageJson.type).toBe('module');
    expect(packageJson.sideEffects).toBe(false);
  });

  it('should export types without side effects', async () => {
    const { Types } = await import('../src/index.js');
    
    expect(Types).toBeDefined();
    expect(typeof Types).toBe('object');
  });

  it('should export builder types without side effects', async () => {
    const { Builder } = await import('../src/index.js');
    
    expect(Builder).toBeDefined();
    expect(typeof Builder).toBe('object');
  });

  it('should export plugin types without side effects', async () => {
    const { Plugins } = await import('../src/index.js');
    
    expect(Plugins).toBeDefined();
    expect(typeof Plugins).toBe('object');
  });

  it('should export package info', async () => {
    const { PACKAGE_INFO } = await import('../src/index.js');
    
    expect(PACKAGE_INFO).toEqual({
      name: '@voltrix/mcp',
      version: '0.1.0',
      description: 'Ultra-lightweight Model Context Protocol implementation',
      treeshaking: true,
      sideEffects: false,
    });
  });
});