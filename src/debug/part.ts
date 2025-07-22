import { type Part, PartType } from '../core.js';
import { debugNode } from './node.js';

export function debugPart(part: Part, marker: string): string {
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
  return debugNode(part.node, marker);
}
