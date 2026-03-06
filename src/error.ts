import { getCoroutineStack } from './debug/scope.js';
import { BoundaryType, type Coroutine, type Scope } from './internal.js';

export class CapturedError extends Error {}

export class RenderError extends Error {
  constructor(coroutine: Coroutine, options?: ErrorOptions) {
    let message = 'An error occurred while rendering.';

    DEBUG: {
      message += getCoroutineStack(coroutine)
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

export function handleError(error: unknown, scope: Scope): Scope {
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

  handleError(error);

  return currentScope;
}
