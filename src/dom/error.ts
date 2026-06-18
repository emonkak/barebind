import type { VElement } from '../core.js';
import { nameOf } from '../debug.js';
import { annotateAttribute, annotateNode, generateNodeFrame } from './debug.js';
import type { DOMPart } from './node.js';

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

export function ensurePartType<
  TPartType extends { new (...args: never[]): DOMPart },
>(
  expectedPartType: TPartType,
  element: VElement,
  part: DOMPart,
): asserts part is InstanceType<TPartType> {
  if (!(part instanceof expectedPartType)) {
    throw DOMRenderError.fromNode(
      (part as DOMPart).node,
      `${nameOf(element.type)} must be used in ${expectedPartType.name}Part.`,
    );
  }
}
