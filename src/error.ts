import type { Scope } from './core.js';
import { formatOwnerStack, getOwnerStack } from './debug.js';

export class RenderError extends Error {
  constructor(scope: Scope, message?: string, options?: ErrorOptions) {
    DEBUG: {
      message += '\n' + formatOwnerStack(getOwnerStack(scope));
    }
    super(message, options);
  }
}
