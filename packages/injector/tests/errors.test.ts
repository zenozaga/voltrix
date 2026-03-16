import { describe, it, expect, beforeEach } from 'vitest';
import { DIContainer } from '../src/container';
import { Injectable, Inject } from '../src/decorators';
import { CircularDependencyError, ProviderNotFoundError, InvalidProviderError } from '../src/errors';

// --- Top-level classes for circular dependency tests ---

@Injectable()
class CircularA { constructor(@Inject('B') public b: any) {} }

@Injectable()
class CircularB { constructor(@Inject('A') public a: any) {} }

@Injectable()
class PropCircularA { @Inject('B') public b: any; }

@Injectable()
class PropCircularB { @Inject('A') public a: any; }

describe('Error Handling', () => {
  let container: DIContainer;

  beforeEach(() => {
    container = new DIContainer();
  });

  describe('Circular Dependencies', () => {
    it('should detect circular dependencies in constructor injection', () => {
      container.register({ token: 'A', useClass: CircularA });
      container.register({ token: 'B', useClass: CircularB });
      
      expect(() => container.get('A')).toThrow(CircularDependencyError);
      expect(() => container.get('A')).toThrow(/Circular dependency detected: A -> B -> A/);
    });

    it('should detect circular dependencies in property injection', () => {
       container.register({ token: 'A', useClass: PropCircularA });
       container.register({ token: 'B', useClass: PropCircularB });
       
       expect(() => container.get('A')).toThrow(CircularDependencyError);
    });
  });

  describe('Missing Providers', () => {
    it('should throw ProviderNotFoundError for unregistered tokens', () => {
      expect(() => container.get('UNKNOWN')).toThrow(ProviderNotFoundError);
    });

    it('should throw ProviderNotFoundError when parent also doesnt have it', () => {
      const parent = new DIContainer();
      const child = parent.createChild();
      expect(() => child.get('UNKNOWN')).toThrow(ProviderNotFoundError);
    });
  });

  describe('Invalid Configurations', () => {
    it('should throw InvalidProviderError for malformed registration', () => {
      // Missing useClass/useValue/useFactory/useExisting
      expect(() => container.register({ token: 'test' } as any)).toThrow(InvalidProviderError);
    });

    it('should throw InvalidProviderError if token is missing', () => {
      expect(() => container.register({ useValue: 123 } as any)).toThrow(InvalidProviderError);
    });
  });
});
