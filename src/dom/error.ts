import { generateNodeFrame } from './debug.js';

export class DOMAdapterError extends Error {
  static withNode(node: Node, message: string): DOMAdapterError {
    DEBUG: {
      message += '\n' + generateNodeFrame(node);
    }
    return new DOMAdapterError(message);
  }
}
