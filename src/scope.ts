import {
  ErrorBoundary,
  type Lanes,
  type Root,
  type Scope,
  type UpdateUnit,
} from './core.js';

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

export function getPendingAncestor<TPart, TRenderer>(
  scope: Scope<TPart, TRenderer>,
  lanes: Lanes,
): Scope<TPart, TRenderer> | null {
  while (isChildScope(scope)) {
    const owner = scope.owner as UpdateUnit<TPart, TRenderer>;
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

export function handleError(scope: Scope, error: unknown): Scope {
  let currentScope = scope;
  let currentBoundary = currentScope.boundary;

  const forwardError = (error: unknown) => {
    while (true) {
      while (currentBoundary !== null) {
        const boundary = currentBoundary;
        currentBoundary = currentBoundary.next;
        if (boundary.type === ErrorBoundary) {
          const { handler } = boundary;
          handler.handleError(error, forwardError);
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

  forwardError(error);

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
