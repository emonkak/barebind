import {
  annotateAttributeHole,
  annotateNode,
  annotateNodeHole,
  generateNodeFrame,
} from './debug.js';

export class DOMNodeError extends Error {
  readonly node: Node;

  static fromNode(
    node: Node,
    message: string,
    options?: ErrorOptions,
  ): DOMNodeError {
    DEBUG: {
      message += '\n' + generateNodeFrame(node, annotateNode(node));
    }
    return new DOMNodeError(node, message, options);
  }

  static fromNodeHole(
    node: Node,
    message: string,
    options?: ErrorOptions,
  ): DOMNodeError {
    DEBUG: {
      message += '\n' + generateNodeFrame(node, annotateNodeHole(node));
    }
    return new DOMNodeError(node, message, options);
  }

  static fromAttributeHole(
    node: Element,
    name: string,
    message: string,
    options?: ErrorOptions,
  ): DOMNodeError {
    DEBUG: {
      message +=
        '\n' + generateNodeFrame(node, annotateAttributeHole(node, name));
    }
    return new DOMNodeError(node, message, options);
  }

  constructor(node: Node, message: string, options?: ErrorOptions) {
    super(message, options);
    this.node = node;
  }
}
