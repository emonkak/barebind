import { DirectiveError } from '../directive.js';
import {
  type DirectiveContext,
  type Part,
  PartType,
  type Primitive,
} from '../internal.js';
import { PrimitiveBinding } from './primitive.js';

export class LivePrimitive<T> implements Primitive<T> {
  static readonly instance: LivePrimitive<any> = new LivePrimitive();

  resolveBinding(
    value: T,
    part: Part,
    _context: DirectiveContext,
  ): LiveBinding<T> {
    if (part.type !== PartType.Live) {
      throw new DirectiveError(
        this,
        value,
        part,
        'LivePrimitive must be used in a live part.',
      );
    }
    return new LiveBinding(value, part);
  }
}

export class LiveBinding<T> extends PrimitiveBinding<T, Part.LivePart> {
  get type(): Primitive<T> {
    return LivePrimitive.instance;
  }

  shouldUpdate(_value: T): boolean {
    return true;
  }

  commit(): void {
    const value = this._value;
    const { node, name } = this._part;
    const currentValue = node[name as keyof Element];

    if (!Object.is(currentValue, value)) {
      (node as any)[name] = value;
    }
  }

  rollback(): void {
    const { node, name, defaultValue } = this._part;
    (node as any)[name] = defaultValue;
  }
}
