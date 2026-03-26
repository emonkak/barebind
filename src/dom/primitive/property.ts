import type { DirectiveContext, Primitive } from '../../core.js';
import { PrimitiveBinding } from '../../primitive.js';
import { ensurePartType } from '../error.js';
import { type DOMPart, PART_TYPE_PROPERTY } from '../part.js';
import type { DOMRenderer } from '../template.js';

const NoValue = Symbol();

export abstract class DOMProperty {
  static resolveBinding<T>(
    value: T,
    part: DOMPart,
    _context: DirectiveContext<DOMPart, DOMRenderer>,
  ): DOMPropertyBinding<T> {
    DEBUG: {
      ensurePartType(PART_TYPE_PROPERTY, DOMProperty, value, part);
    }
    return new DOMPropertyBinding(value, part);
  }
}

export class DOMPropertyBinding<T> extends PrimitiveBinding<
  T,
  DOMPart.Property,
  DOMRenderer
> {
  private _currentValue: T | typeof NoValue = NoValue;

  get type(): Primitive<T, DOMPart.Property> {
    return DOMProperty;
  }

  shouldUpdate(newValue: T): boolean {
    return !Object.is(newValue, this._currentValue);
  }

  override commit(): void {
    const { node, name } = this._part;
    (node as any)[name] = this._pendingValue;
    this._currentValue = this._pendingValue;
  }

  override rollback(): void {
    if (this._currentValue !== NoValue) {
      const { node, name, defaultValue } = this._part;
      (node as any)[name] = defaultValue;
      this._currentValue = NoValue;
    }
  }
}
