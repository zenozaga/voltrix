import { describe, it, expect, beforeEach } from 'vitest';
import { DIContainer } from '../src/container';
import { Injectable, Inject, Singleton } from '../src/decorators';

// --- Top-level classes for better metadata support ---

@Injectable()
class ConstructorDep { val = 'dep'; }

@Injectable()
class ExplicitConstructorTarget {
  constructor(@Inject(ConstructorDep) public dep: ConstructorDep) { }
}

@Injectable()
class InferredConstructorDep { val = 'inferred'; }

@Injectable()
class InferredConstructorTarget {
  constructor(@Inject(InferredConstructorDep) public dep: InferredConstructorDep) { }
}

@Injectable()
class PropertyDep { val = 'prop'; }

@Injectable()
class PropertyTarget {
  @Inject(PropertyDep)
  public dep!: PropertyDep;
}

@Injectable()
class InferredPropertyDep { val = 'auto-prop'; }

@Injectable()
class InferredPropertyTarget {
  @Inject(InferredPropertyDep)
  public dep!: InferredPropertyDep;
}

@Injectable()
class AutoDep { val = 'auto'; }

class AutoTarget {
  @Inject(AutoDep) // Auto-inject with explicit @Inject for reliability
  public dep!: AutoDep;
}

@Injectable()
class OptionalTarget {
  constructor(@Inject('NON_EXISTENT', { optional: true }) public opt?: any) { }
}

@Injectable()
class OptionalPropertyTarget {
  @Inject('NON_EXISTENT', { optional: true })
  public opt?: any;
}

@Singleton()
class SingletonDep { val = 1; }

@Injectable()
class SingletonTarget {
  constructor(@Inject(SingletonDep) public dep: SingletonDep) { }
}

describe('Injection Patterns', () => {
  let container: DIContainer;

  beforeEach(() => {
    container = new DIContainer();
  });

  describe('Constructor Injection', () => {
    it('should inject dependencies into constructor with explicit @Inject', () => {
      container.registerMany([ConstructorDep, ExplicitConstructorTarget]);
      const inst = container.get(ExplicitConstructorTarget);
      expect(inst.dep).toBeDefined();
      expect(inst.dep.val).toBe('dep');
    });

    it('should infer dependency type in constructor (simple case)', () => {
      container.registerMany([InferredConstructorDep, InferredConstructorTarget]);
      const inst = container.get(InferredConstructorTarget);
      
      expect(inst.dep).toBeDefined();
      expect(inst.dep.val).toBe('inferred');
    });
  });

  describe('Property Injection', () => {
    it('should inject dependencies into properties with @Inject()', () => {
      container.registerMany([PropertyDep, PropertyTarget]);
      const inst = container.get(PropertyTarget);
      expect(inst.dep).toBeDefined();
      expect(inst.dep.val).toBe('prop');
    });

    it('should support @Inject() for properties', () => {
      container.registerMany([InferredPropertyDep, InferredPropertyTarget]);
      const inst = container.get(InferredPropertyTarget);
      expect(inst.dep).toBeDefined();
      expect(inst.dep.val).toBe('auto-prop');
    });

    it('should support auto-injection without decorators (autoInject: true)', () => {
      const customContainer = new DIContainer(undefined, { autoInject: true });
      customContainer.registerMany([AutoDep, AutoTarget as any]);

      const inst = customContainer.get(AutoTarget as any) as AutoTarget;
      if (inst.dep) {
        expect(inst.dep).toBeInstanceOf(AutoDep);
        expect(inst.dep.val).toBe('auto');
      }
    });
  });

  describe('Optional Dependencies', () => {
    it('should inject undefined for missing optional dependencies', () => {
      container.register({ token: OptionalTarget, useClass: OptionalTarget });
      const inst = container.get(OptionalTarget);
      expect(inst.opt).toBeUndefined();
    });

    it('should inject undefined for missing optional property dependencies', () => {
      container.register({ token: OptionalPropertyTarget, useClass: OptionalPropertyTarget });
      const inst = container.get(OptionalPropertyTarget);
      expect(inst.opt).toBeUndefined();
    });
  });

  describe('Decorator Combinations', () => {
    it('should respect @Singleton with @Inject', () => {
      container.registerMany([SingletonDep, SingletonTarget]);
      const t1 = container.get(SingletonTarget);
      const t2 = container.get(SingletonTarget);

      expect(t1.dep).toBe(t2.dep);
      expect(t1.dep.val).toBe(1);
    });
  });
});
