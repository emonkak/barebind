import type { RenderNode } from './core.js';
import { formatComponentStack, getComponentStack } from './debug.js';

export class RenderError extends Error {
  constructor(node: RenderNode, message?: string, options?: ErrorOptions) {
    DEBUG: {
      message += '\n' + formatComponentStack(getComponentStack(node));
    }
    super(message, options);
  }
}
