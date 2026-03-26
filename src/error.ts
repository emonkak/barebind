import { BOUNDARY_TYPE_ERROR, type Coroutine, type Scope } from './core.js';
import { formatOwnerStack, getOwnerStack } from './debug.js';

export class CoroutineError extends Error {
  readonly coroutine: Coroutine;

  constructor(coroutine: Coroutine, message?: string, options?: ErrorOptions) {
    DEBUG: {
      message += '\n' + formatOwnerStack(getOwnerStack(coroutine));
    }
    super(message, options);
    this.coroutine = coroutine;
  }
}

export class AbortError extends CoroutineError {}

export class InterruptError extends CoroutineError {}

export function handleError(error: unknown, scope: Scope): Scope {
  let currentScope = scope;
  let currentBoundary = currentScope.boundary;

  const handleError = (error: unknown) => {
    while (true) {
      while (currentBoundary !== null) {
        const boundary = currentBoundary;
        currentBoundary = currentBoundary.next;
        if (boundary.type === BOUNDARY_TYPE_ERROR) {
          const { handler } = boundary;
          handler(error, handleError);
          return;
        }
      }

      if (currentScope.isChild()) {
        currentScope = currentScope.owner.scope;
        currentBoundary = currentScope.boundary;
      } else {
        throw error;
      }
    }
  };

  handleError(error);

  return currentScope;
}
