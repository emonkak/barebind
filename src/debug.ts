import type { Scope } from './abstractions.js';

export function captureOwnerStack(scope: Scope): object[] {
  const ownerStack: object[] = [];
  let current: Scope | null = scope;

  do {
    ownerStack.push(current.owner);
    current = current.parent;
  } while (current !== null);

  return ownerStack.reverse();
}

export function nameOf(owner: object): string {
  return typeof owner === 'function' ? owner.name : owner.constructor.name;
}
