import type { View } from './core.js';
import { formatComponentStack, getComponentStack } from './debug.js';

export class RenderError extends Error {
  readonly view: View;

  constructor(view: View, message?: string, options?: ErrorOptions) {
    DEBUG: {
      message += '\n' + formatComponentStack(getComponentStack(view));
    }
    super(message, options);
    this.view = view;
  }
}
