import { inspectPart, markUsedValue } from '../debug.js';
import type { DirectiveContext } from '../directive.js';
import { type NodePart, type Part, PartType } from '../part.js';
import { type Primitive, PrimitiveBinding } from './primitive.js';

export const NodePrimitive: Primitive<unknown> = {
  get name(): string {
    return 'NodePrimitive';
  },
  ensureValue(_value: unknown, _part: Part): asserts _value is unknown {},
  resolveBinding(
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

class NodeBinding<T> extends PrimitiveBinding<T, NodePart> {
  get directive(): Primitive<T> {
    return NodePrimitive as Primitive<T>;
  }

  shouldUpdate(newValue: T, oldValue: T): boolean {
    return !Object.is(newValue, oldValue);
  }

  mount(): void {
    this._part.node.nodeValue =
      typeof this._pendingValue === 'string'
        ? this._pendingValue
        : (this._pendingValue?.toString() ?? null);
  }

  unmount(): void {
    this._part.node.nodeValue = null;
  }
}
