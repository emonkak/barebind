import { DirectiveError } from '../directive.js';
import {
  type DirectiveContext,
  type Part,
  PartType,
  type Primitive,
} from '../internal.js';
import { PrimitiveBinding } from './primitive.js';

export const LivePrimitive: Primitive<any> = {
  name: 'LivePrimitive',
  resolveBinding<T>(
    value: T,
    part: Part,
    _context: DirectiveContext,
  ): LiveBinding<T> {
    if (part.type !== PartType.Live) {
      throw new DirectiveError(
        LivePrimitive,
        value,
        part,
        'LivePrimitive must be used in a live part.',
      );
    }
    return new LiveBinding(value, part);
  },
};

export class LiveBinding<T> extends PrimitiveBinding<T, Part.LivePart> {
  get type(): Primitive<T> {
    return LivePrimitive;
  }

  shouldBind(_value: T): boolean {
    return true;
  }

  commit(): void {
    const value = this.value;
    const { node, name } = this.part;
    const currentValue = node[name as keyof Element];

    if (!Object.is(currentValue, value)) {
      (node as any)[name] = value;
    }
  }

  rollback(): void {
    const { node, name, defaultValue } = this.part;
    (node as any)[name] = defaultValue;
  }
}
