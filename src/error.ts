import type { RenderTree } from './core.js';
import { formatComponentStack, getComponentStack } from './debug.js';

export class RenderError extends Error {
  readonly tree: RenderTree;

  constructor(tree: RenderTree, message?: string, options?: ErrorOptions) {
    DEBUG: {
      message += '\n' + formatComponentStack(getComponentStack(tree));
    }
    super(message, options);
    this.tree = tree;
  }
}
