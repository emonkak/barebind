import { BoundaryType, type Coroutine, type Scope } from './core.js';
import { getOwnerStack } from './debug/scope.js';

export class InterruptError extends Error {}

export class RenderError extends Error {
  constructor(message: string, coroutine: Coroutine, options?: ErrorOptions) {
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

export function handleError(error: unknown, scope: Scope): Scope {
  let currentScope = scope;
  let { owner: nextOwner, boundary: nextBoundary } = currentScope;

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

      if (nextOwner !== null) {
        const { owner, boundary } = nextOwner.scope;
        currentScope = nextOwner.scope;
        nextOwner = owner;
        nextBoundary = boundary;
      } else {
        throw error;
      }
    }
  };

  handleError(error);

  return currentScope;
}
