import type { Scope } from './core.js';
import { captureOwnerStack, formatOwnerStack } from './debug.js';

export class RenderError extends Error {
  constructor(scope: Scope, message?: string, options?: ErrorOptions) {
    DEBUG: {
      message += '\n' + formatOwnerStack(captureOwnerStack(scope));
    }
    super(message, options);
  }
}
