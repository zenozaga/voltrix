import { describe, it, expect } from 'vitest';
import { classifyHooks, isAsyncFunction } from '../src/hooks/hook-manager.js';
import { compilePipeline } from '../src/hooks/pipeline-runner.js';
import { HookClass } from '../src/hooks/hook-types.js';
import type { Ctx } from '../src/context/context.js';

// ─── isAsyncFunction ──────────────────────────────────────────────────────────

describe('isAsyncFunction', () => {
  it('detects async functions', () => {
    expect(isAsyncFunction(async () => {})).toBe(true);
    expect(isAsyncFunction(async function named() {})).toBe(true);
  });

  it('rejects sync functions', () => {
    expect(isAsyncFunction(() => {})).toBe(false);
    expect(isAsyncFunction(function named() {})).toBe(false);
    expect(isAsyncFunction(() => Promise.resolve())).toBe(false);
  });
});

// ─── classifyHooks ────────────────────────────────────────────────────────────

describe('classifyHooks', () => {
  it('classifies empty array as EMPTY', () => {
    expect(classifyHooks([])).toBe(HookClass.EMPTY);
  });

  it('classifies all-sync as SYNC', () => {
    expect(classifyHooks([() => {}, () => {}])).toBe(HookClass.SYNC);
  });

  it('classifies all-async as ASYNC', () => {
    expect(classifyHooks([async () => {}, async () => {}])).toBe(HookClass.ASYNC);
  });

  it('classifies mixed as MIXED', () => {
    expect(classifyHooks([() => {}, async () => {}])).toBe(HookClass.MIXED);
    expect(classifyHooks([async () => {}, () => {}])).toBe(HookClass.MIXED);
  });
});

// ─── compilePipeline ──────────────────────────────────────────────────────────

describe('compilePipeline', () => {
  const noCtx = {} as Ctx;

  it('returns resolved Promise for empty pipeline', async () => {
    const run = compilePipeline([]);
    await expect(run(noCtx)).resolves.toBeUndefined();
  });

  it('runs sync hooks in order', async () => {
    const log: number[] = [];
    const pipeline = compilePipeline([
      () => { log.push(1); },
      () => { log.push(2); },
      () => { log.push(3); },
    ]);
    await pipeline(noCtx);
    expect(log).toEqual([1, 2, 3]);
  });

  it('runs async hooks in order', async () => {
    const log: number[] = [];
    const pipeline = compilePipeline([
      async () => { log.push(1); },
      async () => { log.push(2); },
      async () => { log.push(3); },
    ]);
    await pipeline(noCtx);
    expect(log).toEqual([1, 2, 3]);
  });

  it('runs mixed hooks in order', async () => {
    const log: number[] = [];
    const pipeline = compilePipeline([
      () => { log.push(1); },
      async () => { log.push(2); },
      () => { log.push(3); },
    ]);
    await pipeline(noCtx);
    expect(log).toEqual([1, 2, 3]);
  });

  it('propagates errors from sync pipeline', async () => {
    const pipeline = compilePipeline([
      () => { throw new Error('sync error'); },
    ]);
    await expect(pipeline(noCtx)).rejects.toThrow('sync error');
  });

  it('propagates errors from async pipeline', async () => {
    const pipeline = compilePipeline([
      async () => { throw new Error('async error'); },
    ]);
    await expect(pipeline(noCtx)).rejects.toThrow('async error');
  });

  it('propagates errors from mixed pipeline', async () => {
    const pipeline = compilePipeline([
      () => {},
      async () => { throw new Error('mixed error'); },
    ]);
    await expect(pipeline(noCtx)).rejects.toThrow('mixed error');
  });
});
