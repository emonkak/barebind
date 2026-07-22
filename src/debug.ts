import type { Owner, Scope } from './base.js';

export function captureOwnerStack(scope: Scope): Owner[] {
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
