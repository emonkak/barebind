import type { Owner, Scope } from './core.js';
import { captureOwnerStack, nameOf } from './debug.js';

export class RenderError extends Error {
  constructor(scope: Scope, message?: string, options?: ErrorOptions) {
    DEBUG: {
      message += '\n' + formatOwnerStack(captureOwnerStack(scope));
    }
    super(message, options);
  }
}

function formatOwnerStack(ownerStack: Owner[]): string {
  const tail = ownerStack.length - 1;
  return ownerStack
    .map((owner, i) => {
      const prefix = i === 0 ? '' : '   '.repeat(i - 1) + '`- ';
      const suffix = i === tail ? ' <- ERROR occurred here!' : '';
      const name = nameOf(owner);
      return prefix + name + suffix;
    })
    .join('\n');
}
