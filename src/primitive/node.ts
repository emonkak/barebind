import { inspectPart, markUsedValue } from '../debug.js';
import type {
  DirectiveContext,
  CommitContext,
  Primitive,
} from '../directive.js';
import { type ChildNodePart, type Part, PartType } from '../part.js';
import { PrimitiveBinding } from './primitive.js';

export const NodePrimitive = {
  name: 'NodePrimitive',
  resolveBinding<T>(
    value: T,
    part: Part,
    _context: DirectiveContext,
  ): NodeBinding<T> {
    if (part.type !== PartType.ChildNode) {
      throw new Error(
        'NodePrimitive must be used in a child node, but it is used here:\n' +
          inspectPart(part, markUsedValue(value)),
      );
    }
    return new NodeBinding(value, part);
  },
} as const satisfies Primitive<unknown>;

export class NodeBinding<T> extends PrimitiveBinding<T, ChildNodePart> {
  private _memoizedValue: T | null = null;

  get directive(): Primitive<T> {
    return NodePrimitive;
  }

  shouldBind(value: T): boolean {
    return !Object.is(value, this._memoizedValue);
  }

  commit(_context: CommitContext): void {
    const value = this._pendingValue;
    this._part.node.nodeValue = value?.toString() ?? null;
    this._memoizedValue = this._pendingValue;
  }

  rollback(_context: CommitContext): void {
    if (this._memoizedValue !== null) {
      this._part.node.nodeValue = null;
      this._memoizedValue = null;
    }
  }
}
