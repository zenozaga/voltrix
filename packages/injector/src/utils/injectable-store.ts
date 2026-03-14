// injectable-store.ts

import { Constructor, Token } from '../providers';

export class InjectableStore {
  private static _map = new Map<Token, Constructor | true>();

  static add(token: Token, implementation?: Constructor) {
    this._map.set(token, implementation ?? true);
  }

  static has(target: Token): boolean {
    return this._map.has(target);
  }

  static getImplementation(token: Token): Constructor | undefined {
    const val = this._map.get(token);
    return typeof val === 'function' ? val : undefined;
  }

  static all(): Token[] {
    return [...this._map.keys()];
  }
}
