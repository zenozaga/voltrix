export class EventBusError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EventBusError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class MaxListenersExceededWarning extends EventBusError {
  constructor(event: string, count: number, max: number) {
    super(
      `MaxListenersExceeded: "${event}" has ${count} listeners (max: ${max}). Possible memory leak.`
    );
    this.name = 'MaxListenersExceededWarning';
  }
}

export class TransportError extends EventBusError {
  constructor(
    message: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'TransportError';
  }
}

export class EventDispatchError extends EventBusError {
  constructor(
    public readonly event: string,
    public readonly cause: Error
  ) {
    super(`Error dispatching event "${event}": ${cause.message}`);
    this.name = 'EventDispatchError';
  }
}
