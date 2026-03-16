import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DIContainer } from '../src/container';
import { Singleton } from '../src/decorators';

// --- Top-level classes for better metadata support and reuse ---

@Singleton()
class HookTarget {}

class DisposableClass {
  static disposeCalled = 0;
  dispose() { DisposableClass.disposeCalled++; }
}

class DestructibleClass {
  static destroyCalled = 0;
  destroy() { DestructibleClass.destroyCalled++; }
}

class ClosableClass {
  static closeCalled = 0;
  close() { ClosableClass.closeCalled++; }
}

@Singleton()
class ClearableTarget {
  static disposeCalled = 0;
  dispose() { ClearableTarget.disposeCalled++; }
}

describe('Advanced Container Features', () => {
  let container: DIContainer;

  beforeEach(() => {
    container = new DIContainer();
    DisposableClass.disposeCalled = 0;
    DestructibleClass.destroyCalled = 0;
    ClosableClass.closeCalled = 0;
    ClearableTarget.disposeCalled = 0;
  });

  describe('Hierarchy', () => {
    it('should resolve from parent if not found in child', () => {
      const parent = new DIContainer();
      parent.register({ token: 'val', useValue: 'parent_val' });
      
      const child = parent.createChild();
      expect(child.get('val')).toBe('parent_val');
    });

    it('should override parent provider in child', () => {
      const parent = new DIContainer();
      parent.register({ token: 'val', useValue: 'parent_val' });
      
      const child = parent.createChild();
      child.register({ token: 'val', useValue: 'child_val' });
      
      expect(child.get('val')).toBe('child_val');
      expect(parent.get('val')).toBe('parent_val');
    });
  });

  describe('Middlewares', () => {
    it('should run middlewares during resolution', () => {
      const log: string[] = [];
      container.use((ctx) => {
        log.push(`before:${String(ctx.token)}`);
        const result = ctx.next();
        log.push(`after:${String(ctx.token)}`);
        return result;
      });
      
      container.register({ token: 'test', useValue: 'val' });
      const result = container.get('test');
      
      expect(result).toBe('val');
      expect(log).toEqual(['before:test', 'after:test']);
    });

    it('should allow middleware to modify the result', () => {
      container.use((ctx) => {
        const val = ctx.next();
        return (val as string).toUpperCase();
      });
      
      container.register({ token: 'test', useValue: 'hello' });
      expect(container.get('test')).toBe('HELLO');
    });
  });

  describe('Hooks', () => {
    it('should emit "create" and "resolve" hooks', () => {
      const createSpy = vi.fn();
      const resolveSpy = vi.fn();
      
      container.on(({ type, token, instance }) => {
        if (type === 'create') createSpy(token, instance);
        if (type === 'resolve') resolveSpy(token, instance);
      });
      
      container.register({ token: HookTarget, useClass: HookTarget });
      
      const a1 = container.get(HookTarget);
      expect(createSpy).toHaveBeenCalledWith(HookTarget, a1);
      expect(resolveSpy).toHaveBeenCalledWith(HookTarget, a1);
      
      createSpy.mockClear();
      resolveSpy.mockClear();
      
      container.get(HookTarget);
      expect(createSpy).not.toHaveBeenCalled();
      expect(resolveSpy).toHaveBeenCalled();
    });
  });

  describe('Disposal', () => {
    it('should call disposal methods automatically', () => {
      container.register({ token: DisposableClass, useClass: DisposableClass, scope: 'singleton' });
      const inst = container.get(DisposableClass);
      expect(inst).toBeInstanceOf(DisposableClass);
      
      container.dispose(DisposableClass);
      expect(DisposableClass.disposeCalled).toBe(1);
    });

    it('should support "destroy" and "close" as disposal methods', () => {
      container.register({ token: 'dec', useClass: DestructibleClass });
      container.register({ token: 'clo', useClass: ClosableClass });
      
      container.get('dec');
      container.get('clo');
      
      container.dispose('dec');
      container.dispose('clo');
      
      expect(DestructibleClass.destroyCalled).toBe(1);
      expect(ClosableClass.closeCalled).toBe(1);
    });

    it('should clear all instances', () => {
      container.register({ token: ClearableTarget, useClass: ClearableTarget });
      container.get(ClearableTarget);
      
      container.clear();
      expect(ClearableTarget.disposeCalled).toBe(1);
      expect(container.getInstances().length).toBe(0);
    });
  });
});
