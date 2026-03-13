import type { Coroutine, Scope } from '../core.js';

export function getOwnerStack(coroutine: Coroutine): Coroutine[] {
  const stack: Coroutine[] = [coroutine];
  let current: Scope | null = coroutine.scope;

  while (current.owner !== null) {
    stack.push(current.owner);
    current = current.owner.scope;
  }

  return stack;
}
