import type { Coroutine, Scope } from '../core.js';

export function formatOwnerStack(ownerStack: Coroutine[]): string {
  const tail = ownerStack.length - 1;
  return ownerStack
    .map((coroutine, i) => {
      const prefix = i === tail ? '' : '   '.repeat(tail - i - 1) + '`- ';
      const suffix = i === 0 ? ' <- ERROR occurred here!' : '';
      return prefix + coroutine.name + suffix;
    })
    .reverse()
    .join('\n');
}

export function getOwnerStack(coroutine: Coroutine): Coroutine[] {
  const stack: Coroutine[] = [coroutine];
  let current: Scope | null = coroutine.scope;

  while (current.isChild()) {
    stack.push(current.owner);
    current = current.owner.scope;
  }

  return stack;
}
