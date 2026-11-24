import type { Scope } from './abstractions.js';

export function areScopesDirty(oldScope: Scope, newScope: Scope): boolean {
  let oldInjection = oldScope.injection;
  let newInjection = newScope.injection;
  while (oldInjection !== newInjection) {
    if (
      oldInjection === null ||
      newInjection === null ||
      oldInjection.instance !== newInjection.instance
    ) {
      return true;
    }
    oldInjection = oldInjection.next;
    newInjection = newInjection.next;
  }
  return false;
}

export function createScope(owner: object): Scope.Root {
  return { owner, parent: null, level: 0, injection: null };
}

export function enterScope(scope: Scope, owner: object): Scope.Child {
  return {
    owner,
    parent: scope,
    level: scope.level + 1,
    injection: scope.injection,
  };
}
