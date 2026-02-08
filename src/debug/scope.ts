import type { Coroutine, Scope } from '../internal.js';

export function getCoroutineStack(coroutine: Coroutine): Coroutine[] {
  const stack: Coroutine[] = [coroutine];
  let current: Scope | null = coroutine.scope;

  do {
    if (current.context !== null) {
      stack.push(current.context);
    }
    current = current.parent;
  } while (current !== null);

  return stack;
}
