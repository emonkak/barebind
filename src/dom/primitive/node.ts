import type { DirectiveContext, Primitive } from '../../core.js';
import { PrimitiveBinding, toStringOrEmpty } from '../../primitive.js';
import type { DOMPart } from '../part.js';
import type { DOMRenderer } from '../template.js';

export abstract class DOMNode {
  static resolveBinding<T>(
    value: T,
    part: DOMPart,
    _context: DirectiveContext<DOMPart, DOMRenderer>,
  ): DOMNodeBinding<T> {
    return new DOMNodeBinding(value, part);
  }
}

export class DOMNodeBinding<TValue> extends PrimitiveBinding<
  TValue,
  DOMPart,
  DOMRenderer
> {
  private _currentValue: TValue | null = null;

  get type(): Primitive<TValue, DOMPart> {
    return DOMNode;
  }

  shouldUpdate(newValue: TValue): boolean {
    return !Object.is(newValue, this._currentValue);
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
