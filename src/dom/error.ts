import type { DirectiveType } from '../core.js';
import { formatValue } from '../debug.js';
import { emphasizeNode, formatPart } from './debug.js';
import { type DOMPart, PART_TYPE_NAMES } from './part.js';

export class DirectiveError<T> extends Error {
  readonly type: DirectiveType<T>;

  readonly value: T;

  readonly part: DOMPart;

  constructor(
    type: DirectiveType<T>,
    value: T,
    part: DOMPart,
    message: string,
  ) {
    DEBUG: {
      const marker = `[[${type.name}(${formatValue(value)}) IS USED IN HERE!]]`;
      message += '\n' + formatPart(part, marker);
    }
    super(message);
    this.type = type;
    this.value = value;
    this.part = part;
  }
}

export class HydrationError extends Error {
  readonly node: Node;

  constructor(node: Node, message: string) {
    DEBUG: {
      message += '\n' + emphasizeNode(node, '[[ERROR IN HERE!]]');
    }
    super(message);
    this.node = node;
  }
}

export function ensurePartType<TPartType extends DOMPart['type']>(
  expectedPartType: TPartType,
  type: DirectiveType<unknown>,
  value: unknown,
  part: DOMPart,
): asserts part is DOMPart & { type: TPartType } {
  if (part.type !== expectedPartType) {
    throw new DirectiveError(
      type,
      value,
      part,
      `${type.name} must be used in ${PART_TYPE_NAMES[expectedPartType]}Part.`,
    );
  }
}
