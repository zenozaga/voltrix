import type { Token } from '../providers';

export async function resolveDependencies<T>(
  deps: (Token | undefined)[],
  resolver: (token: Token) => Promise<T>
): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < deps.length; i++) {
    const token = deps[i];
    if (!token) throw new Error(`Dependency at index ${i} is undefined`);
    results.push(await resolver(token));
  }
  return results;
}
