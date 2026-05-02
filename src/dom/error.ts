import { generateNodeFrame } from './debug.js';

export class DOMTemplateError extends DOMException {
  readonly node: Node;

  constructor(node: Node, message: string) {
    DEBUG: {
      message += '\n' + generateNodeFrame(node);
    }
    super(message);
    this.node = node;
  }
}
