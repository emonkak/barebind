import type { DirectiveContext, Primitive } from '../core.js';
import { inspectPart, markUsedValue } from '../debug.js';
import {
  type ChildNodePart,
  type Part,
  PartType,
  type TextPart,
} from '../part.js';
import { PrimitiveBinding } from './primitive.js';

export const NodePrimitive: Primitive<any> = {
  name: 'NodePrimitive',
  resolveBinding(
    value: unknown,
    part: Part,
    _context: DirectiveContext,
  ): NodeBinding<unknown> {
    if (part.type !== PartType.ChildNode && part.type !== PartType.Text) {
      throw new Error(
        'NodePrimitive must be used in a child node or a text part, but it is used here:\n' +
          inspectPart(part, markUsedValue(value)),
      );
    }
    return new NodeBinding(value, part);
  },
};

class NodeBinding<T> extends PrimitiveBinding<T, ChildNodePart | TextPart> {
  private _memoizedValue: T | null = null;

  get directive(): Primitive<T> {
    return NodePrimitive;
  }

  shouldBind(value: T): boolean {
    return !Object.is(value, this._memoizedValue);
  }

  commit(): void {
    const value = this._pendingValue;
    this._part.node.nodeValue =
      typeof value === 'string' ? value : (value?.toString() ?? null);
    this._memoizedValue = this._pendingValue;
  }

  rollback(): void {
    if (this._memoizedValue !== null) {
      this._part.node.nodeValue = null;
      this._memoizedValue = null;
    }
  }
}
