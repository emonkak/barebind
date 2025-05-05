import { type DirectiveProtocol, resolveBindingTag } from '../coreTypes.js';
import { inspectPart, markUsedValue } from '../debug.js';
import { type NodePart, type Part, PartType } from '../part.js';
import { type Primitive, PrimitiveBinding } from './primitive.js';

export const NodePrimitive: Primitive<unknown> = {
  ensureValue(_value: unknown, _part: Part): asserts _value is unknown {},
  [resolveBindingTag](
    value: unknown,
    part: Part,
    _context: DirectiveProtocol,
  ): NodeBinding {
    if (part.type !== PartType.Node) {
      throw new Error(
        'Node primitive must be used in a node, but it is used here:\n' +
          inspectPart(part, markUsedValue(this)),
      );
    }
    return new NodeBinding(value, part);
  },
};

export class NodeBinding extends PrimitiveBinding<unknown, NodePart> {
  get directive(): Primitive<unknown> {
    return NodePrimitive;
  }

  mount(value: unknown, part: Part): void {
    part.node.nodeValue =
      typeof value === 'string' ? value : (value?.toString() ?? null);
  }

  unmount(_value: unknown, part: NodePart): void {
    part.node.nodeValue = null;
  }

  update(newValue: unknown, _oldValue: unknown, part: NodePart): void {
    this.mount(newValue, part);
  }
}
