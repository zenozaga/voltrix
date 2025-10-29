import { bench, describe, expect } from 'vitest';
import { Container as InversifyContainer, injectable, inject, optional } from 'inversify';
import {
  container as tsGlobal,
  injectable as tsInjectable,
  inject as tsInject,
  delay,
  Lifecycle,
} from 'tsyringe';
import { DIContainer, container, Injectable, Inject, Transient, Singleton } from '@voltrix/injector';

// ============================================================
// ⚙️ CONFIG
// ============================================================
const ITER = 1_000_000;
const RUNS = ITER / 10;

// ============================================================
// 🧩 TEST 1: Auto-injection validation
// ============================================================
describe('🧩 Auto-injection validation (constructor injection)', () => {
  // ---------- INVERSIFY ----------
  @injectable()
  class InvLogger {}
  
  @injectable()
  class InvService {
    constructor(@inject(InvLogger) public logger: InvLogger) {}
  }

  const inv = new InversifyContainer();
  inv.bind(InvLogger).to(InvLogger);
  inv.bind(InvService).to(InvService);

  const invInstance = inv.get(InvService);
  expect(invInstance).toBeInstanceOf(InvService);
  expect(invInstance.logger).toBeInstanceOf(InvLogger);

  // ---------- TSYRINGE ----------
  const ts = tsGlobal.createChildContainer();
  @tsInjectable()
  class TsLogger {}
  @tsInjectable()
  class TsService {
    constructor(@tsInject(delay(() => TsLogger)) public logger: TsLogger) {}
  }
  ts.register(TsLogger, { useClass: TsLogger });
  ts.register(TsService, { useClass: TsService });

  const tsInstance = ts.resolve(TsService);
  expect(tsInstance).toBeInstanceOf(TsService);
  expect(tsInstance.logger).toBeInstanceOf(TsLogger);

  // ---------- VOLTRIX ----------
  class VolLogger {}
  
  class VolService {
    constructor(public logger: VolLogger) {}
  }

  container.register({ token: VolLogger, useClass: VolLogger });
  container.register({ token: VolService, useClass: VolService });

  const volInstance = container.resolve(VolService);
  
  console.log('Voltrix instance:', volInstance);

  expect(volInstance).toBeInstanceOf(VolService);
  expect(volInstance.logger).toBeInstanceOf(VolLogger);

  console.log('✅ Verified: Constructor auto-injection works in all frameworks');
});

// // ============================================================
// // 🧩 TEST 2: Auto-inject performance comparison
// // ============================================================
// describe('🧩 Auto-injection performance (constructor)', () => {
//   // ---------- INVERSIFY ----------
//   @injectable()
//   class InvLogger {}
//   @injectable()
//   class InvService {
//     constructor(@inject(InvLogger) public logger: InvLogger) {}
//   }

//   const inv = new InversifyContainer();
//   inv.bind(InvLogger).to(InvLogger);
//   inv.bind(InvService).to(InvService);

//   // ---------- TSYRINGE ----------
//   const ts = tsGlobal.createChildContainer();
//   @tsInjectable()
//   class TsLogger {}
//   @tsInjectable()
//   class TsService {
//     constructor(@tsInject(delay(() => TsLogger)) public logger: TsLogger) {}
//   }
//   ts.register(TsLogger, { useClass: TsLogger });
//   ts.register(TsService, { useClass: TsService });

//   // ---------- VOLTRIX ----------
//   @Injectable()
//   class VolLogger {}
//   @Injectable()
//   class VolService {
//     constructor(public logger: VolLogger) {}
//   }

//   const vol = new DIContainer();
//   vol.registerMany([VolLogger, VolService]);

//   // ---------- VALIDATION ----------
//   const invTest = inv.get(InvService);
//   const tsTest = ts.resolve(TsService);
//   const volTest = vol.resolve(VolService);

//   if (!invTest.logger || !tsTest.logger || !volTest.logger)
//     throw new Error('❌ One of the containers failed auto-injection');

//   // ---------- BENCHMARK ----------
//   bench(`Inversify - constructor auto inject (${RUNS})`, () => {
//     for (let i = 0; i < RUNS; i++) inv.get(InvService);
//   });

//   bench(`TSyringe - constructor auto inject (${RUNS})`, () => {
//     for (let i = 0; i < RUNS; i++) ts.resolve(TsService);
//   });

//   bench(`Voltrix - constructor auto inject (${RUNS})`, () => {
//     for (let i = 0; i < RUNS; i++) vol.resolve(VolService);
//   });
// });
