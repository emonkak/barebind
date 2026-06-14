import type { Scope } from './core.js';
import { formatComponentStack, getComponentStack } from './debug.js';

export class RenderError extends Error {
  constructor(scope: Scope, message?: string, options?: ErrorOptions) {
    DEBUG: {
      message += '\n' + formatComponentStack(getComponentStack(scope));
    }
    super(message, options);
  }
}
