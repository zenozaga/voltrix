/**
 * Simple, high-performance Object Pool
 * Minimizes GC pressure by reusing instances.
 */
export class ObjectPool<T> {
  private pool: T[] = [];
  private sizeLimit: number;

  constructor(
    private readonly factory: () => T,
    sizeLimit: number = 1000
  ) {
    this.sizeLimit = sizeLimit;
    
    // Warm up the pool with some instances
    for (let i = 0; i < 50; i++) {
      this.pool.push(this.factory());
    }
  }

  /**
   * Acquire an instance from the pool or create a new one.
   */
  acquire(): T {
    const obj = this.pool.pop();
    return obj || this.factory();
  }

  /**
   * Return an instance to the pool.
   */
  release(obj: T): void {
    if (this.pool.length < this.sizeLimit) {
      this.pool.push(obj);
    }
  }

  /**
   * Current size of the pool.
   */
  size(): number {
    return this.pool.length;
  }

  /**
   * Clear the pool.
   */
  clear(): void {
    this.pool = [];
  }
}
