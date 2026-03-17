import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventBus } from '../src/event-bus.js';
import { InMemoryTransport } from '../src/transports/in-memory.js';

// ─── Typed event map used across all tests ────────────────────────────────────

interface AppEvents {
  'user.created': { id: string; email: string };
  'user.deleted': { id: string };
  'order.completed': { orderId: string; total: number };
  'payment.failed': { orderId: string; reason: string };
  ping: void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function bus() {
  return new EventBus<AppEvents>();
}

// ─── Basic emit / on ──────────────────────────────────────────────────────────

describe('EventBus — basic', () => {
  it('calls a registered handler with the payload', async () => {
    const b = bus();
    const handler = vi.fn();
    b.on('user.created', handler);
    await b.emit('user.created', { id: '1', email: 'a@b.com' });
    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith({ id: '1', email: 'a@b.com' });
  });

  it('calls multiple handlers in registration order', async () => {
    const b = bus();
    const order: number[] = [];
    b.on('ping', () => order.push(1));
    b.on('ping', () => order.push(2));
    b.on('ping', () => order.push(3));
    await b.emit('ping', undefined as any);
    expect(order).toEqual([1, 2, 3]);
  });

  it('does not call handlers for other events', async () => {
    const b = bus();
    const handler = vi.fn();
    b.on('order.completed', handler);
    await b.emit('user.created', { id: '1', email: 'a@b.com' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('awaits async handlers', async () => {
    const b = bus();
    let done = false;
    b.on('ping', async () => {
      await new Promise((r) => setTimeout(r, 10));
      done = true;
    });
    await b.emit('ping', undefined as any);
    expect(done).toBe(true);
  });

  it('emits without listeners without throwing', async () => {
    const b = bus();
    await expect(b.emit('ping', undefined as any)).resolves.toBeUndefined();
  });
});

// ─── off ──────────────────────────────────────────────────────────────────────

describe('EventBus — off', () => {
  it('removes a handler via off()', async () => {
    const b = bus();
    const handler = vi.fn();
    b.on('ping', handler);
    b.off('ping', handler);
    await b.emit('ping', undefined as any);
    expect(handler).not.toHaveBeenCalled();
  });

  it('removes a handler via the returned unsubscribe fn', async () => {
    const b = bus();
    const handler = vi.fn();
    const unsub = b.on('ping', handler);
    unsub();
    await b.emit('ping', undefined as any);
    expect(handler).not.toHaveBeenCalled();
  });

  it('silently ignores off() for unknown handler', () => {
    const b = bus();
    expect(() => b.off('ping', vi.fn())).not.toThrow();
  });
});

// ─── once ─────────────────────────────────────────────────────────────────────

describe('EventBus — once', () => {
  it('calls the handler only on the first emit', async () => {
    const b = bus();
    const handler = vi.fn();
    b.once('ping', handler);
    await b.emit('ping', undefined as any);
    await b.emit('ping', undefined as any);
    expect(handler).toHaveBeenCalledOnce();
  });

  it('removes itself after firing', async () => {
    const b = bus();
    b.once('ping', vi.fn());
    await b.emit('ping', undefined as any);
    expect(b.listenerCount('ping')).toBe(0);
  });
});

// ─── Priority ─────────────────────────────────────────────────────────────────

describe('EventBus — priority', () => {
  it('executes high before normal before low', async () => {
    const b = bus();
    const order: string[] = [];
    b.on('ping', () => order.push('normal'));
    b.on('ping', () => order.push('low'), { priority: 'low' });
    b.on('ping', () => order.push('high'), { priority: 'high' });
    await b.emit('ping', undefined as any);
    expect(order).toEqual(['high', 'normal', 'low']);
  });

  it('handles multiple handlers at the same priority in insertion order', async () => {
    const b = bus();
    const order: number[] = [];
    b.on('ping', () => order.push(1), { priority: 'high' });
    b.on('ping', () => order.push(2), { priority: 'high' });
    await b.emit('ping', undefined as any);
    expect(order).toEqual([1, 2]);
  });
});

// ─── Wildcards ────────────────────────────────────────────────────────────────

describe('EventBus — wildcards', () => {
  it('matches single-segment wildcard (user.*)', async () => {
    const b = bus();
    const handler = vi.fn();
    b.on('user.*', handler);
    await b.emit('user.created', { id: '1', email: 'a@b.com' });
    await b.emit('user.deleted', { id: '1' });
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('does not match extra segments with *', async () => {
    const b = bus();
    const handler = vi.fn();
    b.on('user.*', handler);
    // 'order.completed' has different prefix — should not match
    await b.emit('order.completed', { orderId: '1', total: 100 });
    expect(handler).not.toHaveBeenCalled();
  });

  it('matches deep wildcard (**)', async () => {
    const b = new EventBus();
    const handler = vi.fn();
    b.on('**.failed', handler);
    await b.emit('payment.failed' as any, {} as any);
    await b.emit('auth.service.failed' as any, {} as any);
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('unsubscribes wildcard via off()', async () => {
    const b = bus();
    const handler = vi.fn();
    b.on('user.*', handler);
    b.off('user.*', handler);
    await b.emit('user.created', { id: '1', email: 'a@b.com' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('unsubscribes wildcard via returned fn', async () => {
    const b = bus();
    const handler = vi.fn();
    const unsub = b.on('user.*', handler);
    unsub();
    await b.emit('user.created', { id: '1', email: 'a@b.com' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('once on wildcard fires only once', async () => {
    const b = bus();
    const handler = vi.fn();
    b.on('user.*', handler, { once: true });
    await b.emit('user.created', { id: '1', email: 'a@b.com' });
    await b.emit('user.deleted', { id: '1' });
    expect(handler).toHaveBeenCalledOnce();
  });
});

// ─── Middleware ───────────────────────────────────────────────────────────────

describe('EventBus — middleware', () => {
  it('runs middleware before handlers', async () => {
    const b = bus();
    const order: string[] = [];
    b.use(async (event, payload, next) => {
      order.push('middleware');
      await next();
    });
    b.on('ping', () => order.push('handler'));
    await b.emit('ping', undefined as any);
    expect(order).toEqual(['middleware', 'handler']);
  });

  it('can short-circuit by not calling next()', async () => {
    const b = bus();
    const handler = vi.fn();
    b.use(async (_event, _payload, _next) => {
      // intentionally not calling next
    });
    b.on('ping', handler);
    await b.emit('ping', undefined as any);
    expect(handler).not.toHaveBeenCalled();
  });

  it('chains multiple middlewares', async () => {
    const b = bus();
    const order: number[] = [];
    b.use(async (e, p, next) => { order.push(1); await next(); });
    b.use(async (e, p, next) => { order.push(2); await next(); });
    b.on('ping', () => order.push(3));
    await b.emit('ping', undefined as any);
    expect(order).toEqual([1, 2, 3]);
  });
});

// ─── Batch ────────────────────────────────────────────────────────────────────

describe('EventBus — emitBatch', () => {
  it('emits all events', async () => {
    const b = bus();
    const created = vi.fn();
    const completed = vi.fn();
    b.on('user.created', created);
    b.on('order.completed', completed);

    await b.emitBatch([
      { event: 'user.created', payload: { id: '1', email: 'a@b.com' } },
      { event: 'order.completed', payload: { orderId: 'o1', total: 50 } },
    ]);

    expect(created).toHaveBeenCalledOnce();
    expect(completed).toHaveBeenCalledOnce();
  });
});

// ─── Introspection ────────────────────────────────────────────────────────────

describe('EventBus — introspection', () => {
  it('listenerCount returns correct count', () => {
    const b = bus();
    b.on('ping', vi.fn());
    b.on('ping', vi.fn());
    expect(b.listenerCount('ping')).toBe(2);
  });

  it('eventNames lists registered events', () => {
    const b = bus();
    b.on('user.created', vi.fn());
    b.on('ping', vi.fn());
    expect(b.eventNames()).toContain('user.created');
    expect(b.eventNames()).toContain('ping');
  });

  it('hasListeners returns true for exact match', () => {
    const b = bus();
    b.on('ping', vi.fn());
    expect(b.hasListeners('ping')).toBe(true);
  });

  it('hasListeners returns true via wildcard match', () => {
    const b = bus();
    b.on('user.*', vi.fn());
    expect(b.hasListeners('user.created')).toBe(true);
  });

  it('hasListeners returns false when no match', () => {
    const b = bus();
    expect(b.hasListeners('ping')).toBe(false);
  });
});

// ─── clear / dispose ──────────────────────────────────────────────────────────

describe('EventBus — lifecycle', () => {
  it('clear(event) removes only that event', async () => {
    const b = bus();
    const h1 = vi.fn();
    const h2 = vi.fn();
    b.on('ping', h1);
    b.on('user.created', h2);
    b.clear('ping');
    await b.emit('ping', undefined as any);
    await b.emit('user.created', { id: '1', email: 'a@b.com' });
    expect(h1).not.toHaveBeenCalled();
    expect(h2).toHaveBeenCalledOnce();
  });

  it('clear() with no args removes everything', async () => {
    const b = bus();
    const handler = vi.fn();
    b.on('ping', handler);
    b.on('user.*', handler);
    b.clear();
    await b.emit('ping', undefined as any);
    await b.emit('user.created', { id: '1', email: 'a@b.com' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('dispose() clears handlers and middleware', async () => {
    const b = bus();
    const handler = vi.fn();
    const mw = vi.fn(async (_: any, __: any, next: any) => next());
    b.use(mw);
    b.on('ping', handler);
    b.dispose();
    await b.emit('ping', undefined as any);
    expect(handler).not.toHaveBeenCalled();
    expect(mw).not.toHaveBeenCalled();
  });
});

// ─── External Transport ───────────────────────────────────────────────────────

describe('EventBus — transport', () => {
  it('forwards emitted events to the transport', async () => {
    const transport = new InMemoryTransport<AppEvents>();
    const b = new EventBus<AppEvents>({ transport });

    const externalHandler = vi.fn();
    transport.subscribe('user.created', externalHandler);

    await b.emit('user.created', { id: '1', email: 'a@b.com' });
    expect(externalHandler).toHaveBeenCalledOnce();
  });

  it('local handlers still fire when transport is set', async () => {
    const transport = new InMemoryTransport<AppEvents>();
    const b = new EventBus<AppEvents>({ transport });

    const localHandler = vi.fn();
    b.on('ping', localHandler);
    await b.emit('ping', undefined as any);
    expect(localHandler).toHaveBeenCalledOnce();
  });

  it('setTransport replaces the transport at runtime', async () => {
    const b = bus();
    const t1 = new InMemoryTransport<AppEvents>();
    const t2 = new InMemoryTransport<AppEvents>();

    const h1 = vi.fn();
    const h2 = vi.fn();
    t1.subscribe('ping', h1);
    t2.subscribe('ping', h2);

    b.setTransport(t1);
    await b.emit('ping', undefined as any);
    expect(h1).toHaveBeenCalledOnce();
    expect(h2).not.toHaveBeenCalled();

    b.setTransport(t2);
    await b.emit('ping', undefined as any);
    expect(h2).toHaveBeenCalledOnce();
  });
});
