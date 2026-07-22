import type { Owner, Scope } from './base.js';
import { captureOwnerStack, nameOf } from './debug.js';

export class RenderError extends Error {
  static withScope(scope: Scope, message: string, options?: ErrorOptions) {
    DEBUG: {
      message += '\n' + formatOwnerStack(captureOwnerStack(scope));
    }
    return new RenderError(message, options);
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
