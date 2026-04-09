import type { Scope } from './core.js';
import { formatOnwerStack, getOwnerStack } from './debug.js';

export type ErrorHandler = (
  error: unknown,
  propagate: (error: unknown) => void,
) => void;

export class ErrorBoundary {
  private readonly _handler: ErrorHandler;

  constructor(handler: ErrorHandler) {
    this._handler = handler;
  }

  handleError(error: unknown, propagate: (error: unknown) => void): void {
    const handler = this._handler;
    handler(error, propagate);
  }
}

export class RenderError extends Error {
  readonly scope: Scope;

  constructor(scope: Scope, message?: string, options?: ErrorOptions) {
    DEBUG: {
      message += '\n' + formatOnwerStack(getOwnerStack(scope));
    }
    super(message, options);
    this.scope = scope;
  }
}
