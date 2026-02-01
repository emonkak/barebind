import { type DirectiveType, type Part, PartType } from '../internal.js';
import { emphasizeNode } from './node.js';
import { formatValue } from './value.js';

export function debugPart(
  part: Part,
  type: DirectiveType<unknown>,
  value: unknown,
): void {
  if (
    part.type === PartType.ChildNode &&
    (part.node.data === '' || part.node.data.startsWith('/' + type.name + '('))
  ) {
    part.node.data = `/${type.name}(${formatValue(value)})`;
  }
}

export function formatPart(part: Part, marker: string): string {
  switch (part.type) {
    case PartType.Attribute:
      marker = part.name + '=' + marker;
      break;
    case PartType.Event:
      marker = '@' + part.name + '=' + marker;
      break;
    case PartType.Live:
      marker = '$' + part.name + '=' + marker;
      break;
    case PartType.Property:
      marker = '.' + part.name + '=' + marker;
      break;
  }
  return emphasizeNode(part.node, marker);
}

export function undebugPart(part: Part, type: DirectiveType<unknown>): void {
  if (
    part.type === PartType.ChildNode &&
    part.node.data.startsWith('/' + type.name + '(')
  ) {
    part.node.data = '';
  }
}
