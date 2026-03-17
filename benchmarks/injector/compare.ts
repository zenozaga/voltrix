// bench/injector/compare.js
import { performance } from 'node:perf_hooks';
import { Container as InversifyContainer, injectable, inject } from 'inversify';
import { container as tsyringe, injectable as tsInjectable, inject as tsInject } from 'tsyringe';
import { DIContainer } from '@voltrix/injector';

// ============================================================
// ⚙️ Helper benchmark function
// ============================================================
function benchmark(name, fn, iterations = 1_000_000) {
  // Calentar JIT
  for (let i = 0; i < 10_000; i++) fn();

  const start = performance.now();
  for (let i = 0; i < iterations; i++) fn();
  const end = performance.now();

  const totalMs = end - start;
  const nsPerOp = (totalMs * 1_000_000) / iterations;
  const opsPerSec = 1_000_000_000 / nsPerOp;

  console.log(`${name.padEnd(35)} ${opsPerSec.toFixed(2)} ops/sec (${nsPerOp.toFixed(2)} ns/op)`);
}

// ============================================================
// 🧩 Inversify setup
// ============================================================
@injectable()
class InvA {}
@injectable()
class InvB {
  constructor(@inject(InvA) a) {
    this.a = a;
  }
}
const inversify = new InversifyContainer();
inversify.bind(InvA).to(InvA).inSingletonScope();
inversify.bind(InvB).to(InvB).inSingletonScope();

// ============================================================
// 🧩 TSyringe setup
// ============================================================
@tsInjectable()
class TsA {}
@tsInjectable()
class TsB {
  constructor(@tsInject(TsA) a) {
    this.a = a;
  }
}

// ============================================================
// 🧩 Voltrix Injector setup (sin decoradores)
// ============================================================
class VolA {}
class VolB {
  constructor(a) {
    this.a = a;
  }
}

const voltrix = new DIContainer();
voltrix.register({ token: VolA, useClass: VolA, scope: 'singleton' });
voltrix.register({ token: VolB, useClass: VolB, inject: [VolA], scope: 'singleton' });

// ============================================================
// 🚀 Run Benchmarks
// ============================================================
console.log('\n🔬 Dependency Injection Benchmark (Node.js pure)\n');

benchmark('Inversify - singleton A', () => {
  inversify.get(InvA);
});

benchmark('Inversify - dependency B', () => {
  inversify.get(InvB);
});

benchmark('TSyringe - singleton A', () => {
  tsyringe.resolve(TsA);
});

benchmark('TSyringe - dependency B', () => {
  tsyringe.resolve(TsB);
});

benchmark('Voltrix - singleton A', () => {
  voltrix.resolveSync(VolA);
});

benchmark('Voltrix - dependency B', () => {
  voltrix.resolveSync(VolB);
});
