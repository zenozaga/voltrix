export class DIError extends Error {
  constructor(
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = new.target.name;
  }
}
export class ProviderNotFoundError extends DIError {}
export class CircularDependencyError extends DIError {}
export class ResolveTimeoutError extends DIError {}
export class InvalidProviderError extends DIError {}
export class DependencyResolutionError extends DIError {}
