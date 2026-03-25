import type { DirectiveContext, Part, Primitive } from '../core.js';
import { PrimitiveBinding, toStringOrEmpty } from './primitive.js';

export abstract class NodeType {
  static resolveBinding<T>(
    value: T,
    part: Part,
    _context: DirectiveContext,
  ): NodeBinding<T> {
    return new NodeBinding(value, part);
  }
}

export class NodeBinding<T> extends PrimitiveBinding<T, Part> {
  private _currentValue: T | null = null;

  get type(): Primitive<T> {
    return NodeType;
  }

  shouldUpdate(value: T): boolean {
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
