import type { Scope } from './base.js';

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

export function cloneScope(scope: Scope.Child): Scope.Child {
  return {
    owner: scope.owner,
    parent: scope.parent,
    level: scope.level,
    injection: scope.parent.injection,
  };
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
