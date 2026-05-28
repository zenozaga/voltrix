# @voltrix/events

A hyper-fast, strongly-typed Event Bus for the **Voltrix** ecosystem, designed for synchronous and asynchronous communication between modules.

## Features

- **Decoupling**: Connect distinct layers and services of your application without introducing hard dependencies or import circles.
- **Pattern Matching & Wildcards (`*`)**: Subscribe to entire namespaces and event paths dynamically (e.g., `user.*`).
- **Priority Execution**: Control the exact execution order of your event listeners with numerical priorities.
- **Pluggable Architecture**: Easily integrates with local event loops or pluggable distributed transports (such as Redis or NATS) in production.

## Installation

```bash
npm install @voltrix/events
```

## Usage Example

```typescript
import { EventBus } from '@voltrix/events';

const bus = new EventBus();

// Subscribe to a specific event with high execution priority
bus.on('user.created', async (payload) => {
  console.log('User created:', payload.name);
}, { priority: 10 });

// Subscribe to all sub-events under the "user" namespace
bus.on('user.*', (payload) => {
  console.log('Audit log for user action:', payload);
});

// Emit the event
await bus.emit('user.created', { name: 'Zeno' });
```

## License

MIT
