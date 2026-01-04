import { BoundaryType, type ErrorHandler, type Scope } from './internal.js';

export const DETACHED_SCOPE: Scope = Object.freeze(createScope());

export function addErrorHandler(scope: Scope, handler: ErrorHandler): void {
  scope.boundary = {
    type: BoundaryType.Error,
    next: scope.boundary,
    handler,
  };
}

export function createScope(parent: Scope | null = null): Scope {
  return {
    parent,
    boundary: null,
  };
}

export function getHydrationTargetTree(scope: Scope): TreeWalker | null {
  for (
    let boundary = scope.boundary;
    boundary !== null;
    boundary = boundary.next
  ) {
    if (boundary.type === BoundaryType.Hydration) {
      return boundary.targetTree;
    }
  }
  return null;
}

export function getSharedContext(scope: Scope, key: unknown): unknown {
  let currentScope: Scope | null = scope;
  do {
    for (
      let { boundary } = currentScope;
      boundary !== null;
      boundary = boundary.next
    ) {
      if (
        boundary.type === BoundaryType.SharedContext &&
        Object.is(boundary.key, key)
      ) {
        return boundary.value;
      }
    }
    currentScope = currentScope.parent;
  } while (currentScope !== null);
  return undefined;
}

export function handleError(scope: Scope, error: unknown): void {
  let currentScope: Scope = scope;
  let currentBoundary = scope.boundary;

  const handle = (error: unknown) => {
    while (true) {
      while (currentBoundary !== null) {
        const boundary = currentBoundary;
        currentBoundary = currentBoundary.next;
        if (boundary.type === BoundaryType.Error) {
          const { handler } = boundary;
          handler(error, handle);
          return;
        }
      }
      const parentScope = currentScope.parent;
      if (parentScope === null) {
        throw error;
      }
      currentScope = parentScope;
      currentBoundary = parentScope.boundary;
    }
  };

  handle(error);
}

export function setHydrationTargetTree(
  scope: Scope,
  targetTree: TreeWalker,
): void {
  scope.boundary = {
    type: BoundaryType.Hydration,
    next: scope.boundary,
    targetTree,
  };
}

export function setSharedContext(
  scope: Scope,
  key: unknown,
  value: unknown,
): void {
  scope.boundary = {
    type: BoundaryType.SharedContext,
    next: scope.boundary,
    key,
    value,
  };
}
