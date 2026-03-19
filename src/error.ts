import { BOUNDARY_TYPE_ERROR, type Coroutine, type Scope } from './core.js';
import { formatOwnerStack, getOwnerStack } from './debug/coroutine.js';

export class CoroutineError extends Error {
  constructor(coroutine: Coroutine, message?: string, options?: ErrorOptions) {
    DEBUG: {
      message += '\n' + formatOwnerStack(getOwnerStack(coroutine));
    }
    super(message, options);
  }
}

export class AbortError extends CoroutineError {}

export class InterruptError extends CoroutineError {}

export function handleError(error: unknown, scope: Scope): Scope {
  let currentScope = scope;
  let { owner: nextOwner, boundary: nextBoundary } = currentScope;

  const handleError = (error: unknown) => {
    while (true) {
      while (nextBoundary !== null) {
        const boundary = nextBoundary;
        nextBoundary = nextBoundary.next;
        if (boundary.type === BOUNDARY_TYPE_ERROR) {
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
