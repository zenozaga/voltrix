import { describe, it } from 'node:test';
import assert from 'assert';
import { Injectable, Singleton, Transient, container } from '../dist';

console.log('Running DIContainer tests');

describe('DIContainer', () => {
  it('resolves singleton instances correctly', async () => {
    @Singleton()
    class A {}
    container.register({ token: A, useClass: A });
    const a1 = await container.resolve(A);
    const a2 = await container.resolve(A);
    assert.strictEqual(a1, a2);
  });
  it('resolves transient instances correctly', async () => {
    @Transient()
    class B {
      constructor() {
        console.log('B instance created');
      }
    }
    container.register({ token: B, useClass: B });
    const b1 = await container.resolve(B);
    const b2 = await container.resolve(B);
    assert.notStrictEqual(b1, b2);
  });
  it('auto injects dependencies', async () => {
    @Injectable()
    class ServiceA {
      value = 42;
    }
    @Singleton()
    class ServiceB {
      constructor(public a: ServiceA) {}
    }

    console.log(Object.keys(ServiceB.prototype));
    container.register({ token: ServiceB, useClass: ServiceB });

    const b = container.resolve(ServiceB);
    const b2 = container.resolve(ServiceB);

    assert.strictEqual(b.a.value, 42);
    assert.strictEqual(b, b2);
    assert.ok(b.a instanceof ServiceA);
  });
  it('throws error for unknown provider', async () => {
    try {
      class Unknown {}
      container.resolve(Unknown);
    } catch (err) {
      assert.ok(err instanceof Error);
    }
  });
  it('supports factory providers', async () => {
    const token = Symbol('factory');
    container.register({
      token,
      useFactory: () => ({ msg: 'ok' }),
    });
    const obj = await container.resolve<{ msg: string }>(token);
    assert.strictEqual(obj.msg, 'ok');
  });
});
