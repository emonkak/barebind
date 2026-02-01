import type { Coroutine, Scope } from '../internal.js';

export function getCoroutineStack(coroutine: Coroutine): Coroutine[] {
  const stack: Coroutine[] = [coroutine];
  let current: Scope | null = coroutine.scope;

  do {
    if (current.host !== null) {
      stack.push(current.host);
    }
    current = current.parent;
  } while (current !== null);

  return stack;
}
