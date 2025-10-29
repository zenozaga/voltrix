// injectable-store.ts

import { Constructor, Token } from '../providers';

export class InjectableStore {
  private static _map = new Map<Token, true>();

  static add(target: Token) {
    this._map.set(target, true);
  }

  static has(target: Token): boolean {
    return this._map.has(target);
  }

  static all(): Token[] {
    return [...this._map.keys()];
  }
}
