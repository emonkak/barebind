import type { Owner, Scope } from './core.js';

export function formatOwnerStack(ownerStack: Owner[]): string {
  const tail = ownerStack.length - 1;
  return ownerStack
    .map((owner, i) => {
      const prefix = i === 0 ? '' : '   '.repeat(i - 1) + '`- ';
      const suffix = i === tail ? ' <- ERROR occurred here!' : '';
      const name = nameOf(owner);
      return prefix + name + suffix;
    })
    .join('\n');
}

export function getOwnerStack(scope: Scope): Owner[] {
  const ownerStack: Owner[] = [];
  let current: Scope | null = scope;

  do {
    ownerStack.push(current.owner);
    current = current.parent;
  } while (current !== null);

  return ownerStack.reverse();
}

export function nameOf(owner: Owner): string {
  return typeof owner === 'function' ? owner.name : owner.constructor.name;
}
