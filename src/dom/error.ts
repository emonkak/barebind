import type { Directive } from '../core.js';
import { nameOf } from '../debug.js';
import { annotateNode, annotatePlace, generateNodeFrame } from './debug.js';
import {
  type AttributeType,
  type ChildNodeType,
  type DOMPart,
  type ElementType,
  type EventType,
  type LiveType,
  PART_NAMES,
  type PropertyType,
  type TextType,
} from './part.js';

export type DOMPlace =
  | { type: typeof AttributeType; name: string; node: Element }
  | { type: typeof ChildNodeType; node: ChildNode }
  | { type: typeof ElementType; node: Element; unknown?: boolean }
  | { type: typeof EventType; name: string; node: Element }
  | { type: typeof LiveType; name: string; node: Element }
  | { type: typeof PropertyType; name: string; node: Element }
  | { type: typeof TextType; node: Text };

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

  static fromPlace(
    place: DOMPlace,
    message: string,
    options?: ErrorOptions,
  ): DOMRenderError {
    DEBUG: {
      message += '\n' + generateNodeFrame(place.node, annotatePlace(place));
    }
    return new DOMRenderError(place.node, message, options);
  }

  constructor(node: Node, message: string, options?: ErrorOptions) {
    super(message, options);
    this.node = node;
  }
}

export function ensurePartType<TPartType extends DOMPart['type']>(
  expectedPartType: TPartType,
  directive: Directive.ElementDirective,
  part: DOMPart,
): asserts part is DOMPart & { type: TPartType } {
  if (part.type !== expectedPartType) {
    DEBUG: {
      if (true!) {
        throw DOMRenderError.fromPlace(
          part,
          `${nameOf(directive.type)} must be used in ${PART_NAMES[expectedPartType]}Part.`,
        );
      }
    }
    throw DOMRenderError.fromPlace(part, 'The part type mismatches.');
  }
}
