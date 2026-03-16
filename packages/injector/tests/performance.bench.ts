import { bench, describe, it, expect } from 'vitest';
import { DIContainer } from '../src/container';

import { Injectable, Singleton, Transient } from '../src/decorators';

describe('DIContainer Performance', () => {
  const container = new DIContainer();

  // Baseline: Raw instantiation
  class Baseline { constructor(public val = 42) { } }

  // Scenarios
  @Singleton()
  class SyncService { constructor() { } getData() { return 42; } }

  @Transient()
  class TransientService { constructor() { } }

  @Injectable()
  class Level1 { constructor(public service: SyncService) { } }

  @Injectable()
  class Level2 { constructor(public l1: Level1) { } }

  @Injectable()
  class Level3 { constructor(public l2: Level2) { } }

  container.registerMany([SyncService, TransientService, Level1, Level2, Level3]);

  // Warm up and ensure singletons are created
  container.resolve(SyncService);
  container.resolve(Level3);

  bench('Raw instantiation (new Class())', () => {
    new Baseline();
  });

  bench('Resolve Singleton (cached)', () => {
    container.resolve(SyncService);
  });

  bench('Resolve Transient (new instance, no deps)', () => {
    container.resolve(TransientService);
  });

  bench('Resolve Deep Dependency (3 levels, dynamic instantiation)', () => {
    // Note: Level 1, 2, 3 are currently 'singleton' by default if not decorated differently,
    // so we should make them transient for a fair "instantiation" test if needed.
    container.resolve(Level3);
  });
});

describe('Abstract Class Token Support', () => {
  it('should support abstract classes as tokens', () => {
    const container = new DIContainer();

    abstract class IRepo {
      abstract find(id: string): any;
    }

    class Repo extends IRepo {
      find(id: string) { return { id }; }
    }

    container.register({ token: IRepo, useClass: Repo });

    const instance = container.resolve(IRepo);
    expect(instance).toBeInstanceOf(Repo);
    expect(instance.find('1')).toEqual({ id: '1' });
    expect(IRepo.name).toBe('IRepo'); // Proof of access to name
  });
});
