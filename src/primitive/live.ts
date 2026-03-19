import {
  type DirectiveContext,
  PART_TYPE_LIVE,
  type Part,
  type Primitive,
} from '../core.js';
import { ensurePartType } from '../directive.js';
import { PrimitiveBinding } from './primitive.js';

export const LivePrimitive: Primitive<any> = {
  name: 'LivePrimitive',
  resolveBinding(
    value: unknown,
    part: Part,
    _context: DirectiveContext,
  ): LiveBinding<unknown> {
    ensurePartType<Part.LivePart>(PART_TYPE_LIVE, this, value, part);
    return new LiveBinding(value, part);
  },
};

export class LiveBinding<T> extends PrimitiveBinding<T, Part.LivePart> {
  get type(): Primitive<T> {
    return LivePrimitive;
  }

  shouldUpdate(_value: T): boolean {
    return true;
  }

  override commit(): void {
    const value = this._value;
    const { node, name } = this._part;
    const currentValue = node[name as keyof Element];

    if (!Object.is(currentValue, value)) {
      (node as any)[name] = value;
    }
  }

  override rollback(): void {
    const { node, name, defaultValue } = this._part;
    (node as any)[name] = defaultValue;
  }
}
