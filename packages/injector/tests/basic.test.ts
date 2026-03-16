import { describe, it, expect, beforeEach } from 'vitest';
import { DIContainer } from '../src/container';
import { Singleton, Transient, Scoped } from '../src/decorators';

describe('Basic Resolution', () => {
  let container: DIContainer;

  beforeEach(() => {
    container = new DIContainer();
  });

  describe('Scopes', () => {
    it('should resolve singleton instances (same instance)', () => {
      @Singleton()
      class A {}
      container.register({ token: A, useClass: A });
      
      const a1 = container.get(A);
      const a2 = container.get(A);
      expect(a1).toBe(a2);
    });

    it('should resolve transient instances (new instance every time)', () => {
      @Transient()
      class B {}
      container.register({ token: B, useClass: B });
      
      const b1 = container.get(B);
      const b2 = container.get(B);
      expect(b1).not.toBe(b2);
    });

    it('should resolve scoped instances (same instance within container)', () => {
      @Scoped()
      class C {}
      container.register({ token: C, useClass: C });
      
      const c1 = container.get(C);
      const c2 = container.get(C);
      expect(c1).toBe(c2);
    });
  });

  describe('Provider Types', () => {
    it('should support useClass', () => {
      class Base {}
      class Impl extends Base {}
      container.register({ token: Base, useClass: Impl });
      
      expect(container.get(Base)).toBeInstanceOf(Impl);
    });

    it('should support useValue', () => {
      const TOK = Symbol('VAL');
      container.register({ token: TOK, useValue: { foo: 'bar' } });
      
      expect(container.get(TOK)).toEqual({ foo: 'bar' });
    });

    it('should support useFactory', () => {
      const TOK = Symbol('FACTORY');
      container.register({
        token: TOK,
        useFactory: () => 'factory_result'
      });
      
      expect(container.get(TOK)).toBe('factory_result');
    });

    it('should support useExisting', () => {
      const TOK1 = Symbol('TOK1');
      const TOK2 = Symbol('TOK2');
      container.register({ token: TOK1, useValue: 'target' });
      container.register({ token: TOK2, useExisting: TOK1 });
      
      expect(container.get(TOK2)).toBe('target');
    });
  });

  describe('Aliases and Industry Standards', () => {
    it('should support "provide" as an alias for "token"', () => {
      container.register({ provide: 'test', useValue: 123 });
      expect(container.get('test')).toBe(123);
    });

    it('should support "useToken" as an alias for "useExisting"', () => {
      container.register({ provide: 'orig', useValue: 'val' });
      container.register({ provide: 'alias', useToken: 'orig' });
      expect(container.get('alias')).toBe('val');
    });

    it('should support abstract classes as tokens', () => {
      abstract class IService { abstract run(): string; }
      class Service extends IService { run() { return 'ok'; } }
      
      container.register({ token: IService, useClass: Service });
      const inst = container.get(IService);
      
      expect(inst).toBeInstanceOf(Service);
      expect(inst.run()).toBe('ok');
    });
  });

  describe('registerMany', () => {
    it('should register multiple classes at once', () => {
      class A {}
      class B {}
      container.registerMany([A, B]);
      
      expect(container.has(A)).toBe(true);
      expect(container.has(B)).toBe(true);
      expect(container.get(A)).toBeInstanceOf(A);
      expect(container.get(B)).toBeInstanceOf(B);
    });
  });
});
