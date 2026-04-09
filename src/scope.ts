import type { Root, Scope, UpdateUnit } from './core.js';
import { ErrorBoundary } from './error.js';

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
  owner: UpdateUnit<TPart, TRenderer>,
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

export function handleError(scope: Scope, error: unknown): Scope {
  let currentScope = scope;
  let currentBoundary = currentScope.boundary;

  const propagate = (error: unknown) => {
    while (true) {
      while (currentBoundary !== null) {
        const boundary = currentBoundary;
        currentBoundary = currentBoundary.next;
        if (boundary.instance instanceof ErrorBoundary) {
          boundary.instance.handleError(error, propagate);
          return;
        }
      }

      if (isChildScope(currentScope)) {
        currentScope = currentScope.owner.scope;
        currentBoundary = currentScope.boundary;
      } else {
        throw error;
      }
    }
  };

  propagate(error);

  return currentScope;
}

export function isChildScope<TPart, TRenderer>(
  scope: Scope<TPart, TRenderer>,
): scope is Scope.ChildScope<TPart, TRenderer> {
  return scope.level > 0;
}

export function isRootScope(scope: Scope): scope is Scope.ChildScope {
  return scope.level === 0 && scope.owner !== null;
}
