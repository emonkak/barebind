import { type Part, PartType } from '../internal.js';
import { formatNode } from './node.js';

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
  return formatNode(part.node, marker);
}
