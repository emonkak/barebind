import type { DirectiveContext, Primitive } from '../core.js';
import type { DOMPart } from '../dom.js';
import { PrimitiveBinding, toStringOrEmpty } from './primitive.js';

export abstract class NodeType {
  static resolveBinding<T>(
    value: T,
    part: DOMPart,
    _context: DirectiveContext,
  ): NodeBinding<T> {
    return new NodeBinding(value, part);
  }
}

export class NodeBinding<TValue> extends PrimitiveBinding<TValue, DOMPart> {
  private _currentValue: TValue | null = null;

  get type(): Primitive<TValue, DOMPart> {
    return NodeType;
  }

  shouldUpdate(value: TValue): boolean {
    return !Object.is(value, this._currentValue);
  }

  override commit(): void {
    const { node } = this._part;
    const value = this._pendingValue;
    node.nodeValue = toStringOrEmpty(value);
    this._currentValue = this._pendingValue;
  }

  override rollback(): void {
    if (this._currentValue !== null) {
      this._part.node.nodeValue = '';
      this._currentValue = null;
    }
  }
}
