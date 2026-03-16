import { describe, it, expect } from 'vitest';
import { Metadata } from '../src/metadata.js';

describe('Metadata (Unified System)', () => {
  it('should store multiple prefixes in the same root object', () => {
    class Target { }
    const property = 'method';

    const swagger = Metadata.prefix('openapi');
    const security = Metadata.prefix('security');

    swagger.set(Target.prototype, property, { summary: 'test' });
    security.set(Target.prototype, property, { roles: ['admin'] });

    const root = Metadata.get(Target.prototype, property);

    expect(root).toEqual({
      openapi: { summary: 'test' },
      security: { roles: ['admin'] }
    });
  });

  it('should auto-initialize and maintain object references', () => {
    class Target { }
    const m1 = Metadata.get(Target);
    m1.test = 123;

    const m2 = Metadata.get(Target);
    expect(m2.test).toBe(123);
    expect(m1).toBe(m2);
  });

  it('should track classes in the global discovery index', () => {
    class App { }
    class Mod { }

    Metadata.get(App);
    Metadata.get(Mod);

    const tracked = Metadata.getTrackedClasses();
    expect(tracked).toContain(App);
    expect(tracked).toContain(Mod);
  });

  it('should handle property-level vs class-level metadata independently', () => {
    class Target { }
    const swagger = Metadata.prefix('openapi');

    swagger.set(Target, undefined, { type: 'class' });
    swagger.set(Target.prototype, 'method', { type: 'method' });

    expect(swagger.get(Target)).toEqual({ type: 'class' });
    expect(swagger.get(Target.prototype, 'method')).toEqual({ type: 'method' });
  });
});
