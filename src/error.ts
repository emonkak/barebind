import { ErrorBoundary, type Scope } from './core.js';
import { formatOnwerStack, getOwnerStack } from './debug.js';
import { isChildScope } from './scope.js';

export abstract class RenderError extends Error {
  readonly scope: Scope;

  constructor(scope: Scope, message?: string, options?: ErrorOptions) {
    DEBUG: {
      message += '\n' + formatOnwerStack(getOwnerStack(scope));
    }
    super(message, options);
    this.scope = scope;
  }
}

export class AbortError extends RenderError {}

export class InterruptError extends RenderError {}

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
