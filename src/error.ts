import { BoundaryType, type Coroutine, Lane, type Scope } from './core.js';
import { getOwnerStack } from './debug/scope.js';

export class InterruptError extends Error {}

export class RenderError extends Error {
  constructor(coroutine: Coroutine, options?: ErrorOptions) {
    let message = 'An error occurred while rendering.';

    DEBUG: {
      message += getOwnerStack(coroutine)
        .reverse()
        .map((coroutine, i, stack) => {
          const prefix = i > 0 ? '   '.repeat(i - 1) + '`- ' : '';
          const suffix =
            i === stack.length - 1 ? ' <- ERROR occurred here!' : '';
          return '\n' + prefix + coroutine.name + suffix;
        })
        .join('');
    }

    super(message, options);
  }
}

export function handleError(
  error: unknown,
  scope: Scope,
  coroutine: Coroutine,
): void {
  let currentScope = scope;
  let { parent: nextScope, boundary: nextBoundary } = currentScope;

  const handleError = (error: unknown) => {
    while (true) {
      while (nextBoundary !== null) {
        const boundary = nextBoundary;
        nextBoundary = nextBoundary.next;
        if (boundary.type === BoundaryType.Error) {
          const { handler } = boundary;
          handler(error, handleError);
          return;
        }
      }

      if (nextScope !== null) {
        const { parent, boundary } = nextScope;
        currentScope = nextScope;
        nextScope = parent;
        nextBoundary = boundary;
      } else {
        throw error;
      }
    }
  };

  try {
    handleError(error);
  } catch (error) {
    throw new RenderError(coroutine, { cause: error });
  }

  if ((currentScope.owner?.pendingLanes ?? Lane.NoLane) === Lane.NoLane) {
    // The error was captured but no recovery render was scheduled.
    // Detach the scope to stop further updates on this subtree.
    throw new InterruptError(undefined, { cause: error });
  }
}
