import { generateNodeFrame } from './debug.js';

export class DOMTemplateError extends DOMException {
  constructor(node: Node, message: string) {
    DEBUG: {
      message += '\n' + generateNodeFrame(node);
    }
    super(message);
  }
}
