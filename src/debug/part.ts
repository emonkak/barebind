import {
  type DirectiveType,
  PART_TYPE_ATTRIBUTE,
  PART_TYPE_CHILD_NODE,
  PART_TYPE_EVENT,
  PART_TYPE_LIVE,
  PART_TYPE_PROPERTY,
  type Part,
} from '../core.js';
import { emphasizeNode } from './node.js';
import { formatValue } from './value.js';

export function debugPart(
  part: Part,
  type: DirectiveType<unknown>,
  value: unknown,
): void {
  if (
    part.type === PART_TYPE_CHILD_NODE &&
    (part.node.data === '' || part.node.data.startsWith('/' + type.name + '('))
  ) {
    part.node.data = `/${type.name}(${formatValue(value)})`;
  }
}

export function formatPart(part: Part, marker: string): string {
  switch (part.type) {
    case PART_TYPE_ATTRIBUTE:
      marker = part.name + '=' + marker;
      break;
    case PART_TYPE_EVENT:
      marker = '@' + part.name + '=' + marker;
      break;
    case PART_TYPE_LIVE:
      marker = '$' + part.name + '=' + marker;
      break;
    case PART_TYPE_PROPERTY:
      marker = '.' + part.name + '=' + marker;
      break;
  }
  return emphasizeNode(part.node, marker);
}

export function undebugPart(part: Part, type: DirectiveType<unknown>): void {
  if (
    part.type === PART_TYPE_CHILD_NODE &&
    part.node.data.startsWith('/' + type.name + '(')
  ) {
    part.node.data = '';
  }
}
