import { annotateAttribute, annotateNode, generateNodeFrame } from './debug.js';

export class DOMRenderError extends Error {
  readonly node: Node;

  static fromNode(
    node: Node,
    message: string,
    options?: ErrorOptions,
  ): DOMRenderError {
    DEBUG: {
      message += '\n' + generateNodeFrame(node, annotateNode(node));
    }
    return new DOMRenderError(node, message, options);
  }

  static fromAttribute(
    node: Element,
    name: string,
    message: string,
    options?: ErrorOptions,
  ): DOMRenderError {
    DEBUG: {
      message += '\n' + generateNodeFrame(node, annotateAttribute(node, name));
    }
    return new DOMRenderError(node, message, options);
  }

  constructor(node: Node, message: string, options?: ErrorOptions) {
    super(message, options);
    this.node = node;
  }
}
