import type { Owner, Scope } from './core.js';

export function formatOwnerStack(ownerStack: Owner[]): string {
  const tail = ownerStack.length - 1;
  return ownerStack
    .map((owner, i) => {
      const prefix = i === tail ? '' : '   '.repeat(tail - i - 1) + '`- ';
      const suffix = i === 0 ? ' <- ERROR occurred here!' : '';
      const name =
        typeof owner === 'function' ? owner.name : owner.constructor.name;
      return prefix + name + suffix;
    })
    .reverse()
    .join('\n');
}

export function getOwnerStack(scope: Scope): Owner[] {
  const ownerStack: Owner[] = [];
  let current: Scope | null = scope;

  do {
    ownerStack.push(current.owner);
    current = current.parent;
  } while (current !== null);

  return ownerStack;
}
