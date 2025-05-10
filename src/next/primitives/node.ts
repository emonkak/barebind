import { type DirectiveContext, resolveBindingTag } from '../coreTypes.js';
import { inspectPart, markUsedValue } from '../debug.js';
import { type NodePart, type Part, PartType } from '../part.js';
import { type Primitive, PrimitiveBinding } from './primitive.js';

export const NodePrimitive: Primitive<unknown> = {
  ensureValue(_value: unknown, _part: Part): asserts _value is unknown {},
  [resolveBindingTag](
    value: unknown,
    part: Part,
    _context: DirectiveContext,
  ): NodeBinding<unknown> {
    if (part.type !== PartType.Node) {
      throw new Error(
        'Node primitive must be used in a node part, but it is used here:\n' +
          inspectPart(part, markUsedValue(this)),
      );
    }
    return new NodeBinding(value, part);
  },
};

export class NodeBinding<T> extends PrimitiveBinding<T, NodePart> {
  get directive(): Primitive<T> {
    return NodePrimitive as Primitive<T>;
  }

  shouldUpdate(newValue: T, oldValue: T): boolean {
    return !Object.is(newValue, oldValue);
  }

  mount(value: T, part: Part): void {
    part.node.nodeValue =
      typeof value === 'string' ? value : (value?.toString() ?? null);
  }

  unmount(_value: T, part: NodePart): void {
    part.node.nodeValue = null;
  }

  update(newValue: T, _oldValue: T, part: NodePart): void {
    this.mount(newValue, part);
  }
}
