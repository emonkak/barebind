import type { DirectiveContext } from '../core.js';
import { inspectPart, markUsedValue } from '../debug.js';
import { type ChildNodePart, type Part, PartType } from '../part.js';
import { type Primitive, PrimitiveBinding } from './primitive.js';

export const ChildNodePrimitive: Primitive<any> = {
  name: 'ChildNodePrimitive',
  ensureValue(_value: unknown, _part: Part): asserts _value is unknown {},
  resolveBinding(
    value: unknown,
    part: Part,
    _context: DirectiveContext,
  ): ChildNodeBinding<unknown> {
    if (part.type !== PartType.ChildNode) {
      throw new Error(
        'ChildNodePrimitive must be used in a child node part, but it is used here:\n' +
          inspectPart(part, markUsedValue(this)),
      );
    }
    return new ChildNodeBinding(value, part);
  },
};

class ChildNodeBinding<T> extends PrimitiveBinding<T, ChildNodePart> {
  private _memoizedValue: T | null = null;

  get directive(): Primitive<T> {
    return ChildNodePrimitive;
  }

  shouldBind(value: T): boolean {
    return !Object.is(value, this._memoizedValue);
  }

  commit(): void {
    const value = this._pendingValue;
    const { node } = this._part;

    node.nodeValue =
      typeof value === 'string' ? value : (value?.toString() ?? null);

    this._memoizedValue = this._pendingValue;
  }

  rollback(): void {
    if (this._memoizedValue !== null) {
      const { node } = this._part;
      node.nodeValue = null;
      this._memoizedValue = null;
    }
  }
}
