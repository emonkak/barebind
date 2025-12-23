import { DirectiveError } from '../directive.js';
import {
  type DirectiveContext,
  type Part,
  PartType,
  type Primitive,
} from '../internal.js';
import { PrimitiveBinding } from './primitive.js';

export class AttributePrimitive<T> implements Primitive<T> {
  static readonly instance: AttributePrimitive<any> = new AttributePrimitive();

  resolveBinding(
    value: T,
    part: Part,
    _context: DirectiveContext,
  ): AttributeBinding<T> {
    if (part.type !== PartType.Attribute) {
      throw new DirectiveError(
        this,
        value,
        part,
        'AttributePrimitive must be used in an attribute part.',
      );
    }
    return new AttributeBinding(value, part);
  }
}

export class AttributeBinding<T> extends PrimitiveBinding<
  T,
  Part.AttributePart
> {
  private _memoizedValue: T | null = null;

  get type(): Primitive<T> {
    return AttributePrimitive.instance;
  }

  shouldUpdate(value: T): boolean {
    return !Object.is(value, this._memoizedValue);
  }

  commit(): void {
    const { node, name } = this.part;
    const value = this.value;

    switch (typeof value) {
      case 'string':
        node.setAttribute(name, value);
        break;
      case 'boolean':
        node.toggleAttribute(name, value);
        break;
      default:
        if (value == null) {
          node.removeAttribute(name);
        } else {
          node.setAttribute(name, value.toString());
        }
    }

    this._memoizedValue = this.value;
  }

  rollback(): void {
    if (this._memoizedValue !== null) {
      const { node, name } = this.part;
      node.removeAttribute(name);
      this._memoizedValue = null;
    }
  }
}
