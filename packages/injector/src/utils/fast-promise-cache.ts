export class FastPromiseCache<K, V> {
  private inflight = new Map<K, Promise<V>>();

  async run(key: K, factory: () => Promise<V>): Promise<V> {
    const cached = this.inflight.get(key);
    if (cached) return cached;
    const p = factory().finally(() => this.inflight.delete(key));
    this.inflight.set(key, p);
    return p;
  }

  clear(key?: K) {
    if (key === undefined) this.inflight.clear();
    else this.inflight.delete(key);
  }
}
