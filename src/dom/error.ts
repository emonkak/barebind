import { annotateAttribute, annotateNode, generateNodeFrame } from './debug.js';

export class DOMNodeError extends Error {
  readonly node: Node;

  constructor(node: Node, message: string, options?: ErrorOptions) {
    DEBUG: {
      message += '\n' + generateNodeFrame(node, annotateNode(node));
    }
    super(message, options);
    this.node = node;
  }
}

export class DOMAttributeError extends Error {
  readonly attribute: Attr;

  constructor(attribute: Attr, message: string, options?: ErrorOptions) {
    DEBUG: {
      message +=
        '\n' +
        generateNodeFrame(
          attribute.ownerElement!,
          annotateAttribute(attribute),
        );
    }
    super(message, options);
    this.attribute = attribute;
  }
}
