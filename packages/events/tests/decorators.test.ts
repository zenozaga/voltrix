import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../src/event-bus.js';
import { OnEvent } from '../src/decorators/on-event.js';
import { EmitEvent } from '../src/decorators/emit-event.js';
import { bindEventListeners, EventRegistry } from '../src/registry.js';

interface AppEvents {
  'user.created': { id: string };
  'user.deleted': { id: string };
  'order.completed': { orderId: string };
}

// ─── @OnEvent ─────────────────────────────────────────────────────────────────

describe('@OnEvent — metadata', () => {
  it('registers listener metadata on the class', () => {
    class Svc {
      @OnEvent('user.created')
      handle(_payload: AppEvents['user.created']) {}
    }

    const listeners = EventRegistry.getListeners(Svc);
    expect(listeners).toHaveLength(1);
    expect(listeners[0].event).toBe('user.created');
    expect(listeners[0].propertyKey).toBe('handle');
  });

  it('registers multiple listeners on the same class', () => {
    class Svc {
      @OnEvent('user.created')
      onCreate(_p: AppEvents['user.created']) {}

      @OnEvent('user.deleted')
      onDelete(_p: AppEvents['user.deleted']) {}
    }

    expect(EventRegistry.getListeners(Svc)).toHaveLength(2);
  });

  it('stores priority option', () => {
    class Svc {
      @OnEvent('user.created', { priority: 'high' })
      handle(_p: AppEvents['user.created']) {}
    }

    const [meta] = EventRegistry.getListeners(Svc);
    expect(meta.options.priority).toBe('high');
  });
});

describe('@OnEvent — bindEventListeners', () => {
  it('binds decorated methods to the bus', async () => {
    const b = new EventBus<AppEvents>();
    const received: AppEvents['user.created'][] = [];

    class NotificationService {
      @OnEvent('user.created')
      handleCreated(payload: AppEvents['user.created']) {
        received.push(payload);
      }
    }

    const svc = new NotificationService();
    bindEventListeners(svc, b);

    await b.emit('user.created', { id: '42' });
    expect(received).toEqual([{ id: '42' }]);
  });

  it('returned unsubscribers remove the listener', async () => {
    const b = new EventBus<AppEvents>();
    const handler = vi.fn();

    class Svc {
      @OnEvent('user.created')
      handle(_p: AppEvents['user.created']) {
        handler();
      }
    }

    const svc = new Svc();
    const unsubs = bindEventListeners(svc, b);
    unsubs.forEach((u) => u());

    await b.emit('user.created', { id: '1' });
    expect(handler).not.toHaveBeenCalled();
  });
});

// ─── @EmitEvent ───────────────────────────────────────────────────────────────

describe('@EmitEvent', () => {
  it('emits the return value as the event payload', async () => {
    const b = new EventBus<AppEvents>();
    const received: AppEvents['user.created'][] = [];
    b.on('user.created', (p) => received.push(p));

    class UserService {
      eventBus = b;

      @EmitEvent('user.created')
      async create(): Promise<AppEvents['user.created']> {
        return { id: 'new-user' };
      }
    }

    const svc = new UserService();
    await svc.create();
    expect(received).toEqual([{ id: 'new-user' }]);
  });

  it('applies transform option before emitting', async () => {
    const b = new EventBus<AppEvents>();
    const received: AppEvents['user.created'][] = [];
    b.on('user.created', (p) => received.push(p));

    class UserService {
      eventBus = b;

      @EmitEvent('user.created', { transform: (r) => ({ id: (r as any).rawId }) })
      async create() {
        return { rawId: 'raw-123' };
      }
    }

    const svc = new UserService();
    await svc.create();
    expect(received[0]).toEqual({ id: 'raw-123' });
  });

  it('still returns the original method result', async () => {
    const b = new EventBus<AppEvents>();
    b.on('user.created', vi.fn());

    class UserService {
      eventBus = b;

      @EmitEvent('user.created')
      async create() {
        return { id: '1' };
      }
    }

    const result = await new UserService().create();
    expect(result).toEqual({ id: '1' });
  });

  it('does not throw when no eventBus property is present', async () => {
    class UserService {
      @EmitEvent('user.created')
      async create() {
        return { id: '1' };
      }
    }

    await expect(new UserService().create()).resolves.toEqual({ id: '1' });
  });
});
