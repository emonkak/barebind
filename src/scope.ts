import type { Lanes, Root, Scope, Slot } from './core.js';

export const OrphanScope: Scope.OrphanScope = Object.freeze({
  owner: null,
  level: 0,
  boundary: null,
});

export function containsScope(origin: Scope, scope: Scope): boolean {
  while (scope.level <= origin.level) {
    if (scope === origin) {
      return true;
    }
    if (!isChildScope(scope)) {
      break;
    }
    scope = scope.owner.scope;
  }
  return false;
}

export function createChildScope<TPart, TRenderer>(
  owner: Slot<TPart, TRenderer>,
): Scope.ChildScope<TPart, TRenderer> {
  return {
    owner,
    level: owner.scope.level + 1,
    boundary: null,
  };
}

export function createRootScope<TPart>(
  owner: Root<TPart>,
): Scope.RootScope<TPart> {
  return {
    owner,
    level: 0,
    boundary: null,
  };
}

export function getPendingAncestor<TPart, TRenderer>(
  scope: Scope<TPart, TRenderer>,
  lanes: Lanes,
): Scope<TPart, TRenderer> | null {
  while (isChildScope(scope)) {
    const owner = scope.owner as Slot<TPart, TRenderer>;
    if ((owner.pendingLanes & lanes) === lanes) {
      return scope;
    }
    scope = owner.scope;
  }
  return null;
}

export function getRootScope<TPart, TRenderer>(
  scope: Scope<TPart, TRenderer>,
): Scope.RootScope<TPart> | null {
  while (isChildScope(scope)) {
    scope = scope.owner.scope;
  }
  return isRootScope(scope) ? scope : null;
}

export function isChildScope<TPart, TRenderer>(
  scope: Scope<TPart, TRenderer>,
): scope is Scope.ChildScope<TPart, TRenderer> {
  return scope.level > 0;
}

export function isRootScope(scope: Scope): scope is Scope.ChildScope {
  return scope.level === 0 && scope.owner !== null;
}
