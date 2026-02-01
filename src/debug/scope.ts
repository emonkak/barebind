import type { Coroutine, Scope } from '../internal.js';

export function getCoroutineStack(coroutine: Coroutine): string[] {
  const stack: string[] = [coroutine.name];
  let current: Scope | null = coroutine.scope;

  do {
    if (current.host !== null) {
      stack.push(current.host.name);
    }
    current = current.parent;
  } while (current !== null);

  return stack;
}
