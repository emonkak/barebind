import type { Scope } from './core.js';
import { formatOnwerStack, getOwnerStack } from './debug.js';

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
