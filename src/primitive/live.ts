import { inspectPart, markUsedValue } from '../debug.js';
import type {
  DirectiveContext,
  CommitContext,
  Primitive,
} from '../directive.js';
import { type LivePart, type Part, PartType } from '../part.js';
import { PrimitiveBinding } from './primitive.js';

export const LivePrimitive = {
  name: 'LivePrimitive',
  resolveBinding<T>(
    value: T,
    part: Part,
    _context: DirectiveContext,
  ): LiveBinding<T> {
    if (part.type !== PartType.Live) {
      throw new Error(
        'LivePrimitive must be used in a live part, but it is used here:\n' +
          inspectPart(part, markUsedValue(value)),
      );
    }
    return new LiveBinding(value, part);
  },
} as const satisfies Primitive<unknown>;

export class LiveBinding<T> extends PrimitiveBinding<T, LivePart> {
  get directive(): Primitive<T> {
    return LivePrimitive;
  }

  shouldBind(_value: T): boolean {
    return true;
  }

  commit(_context: CommitContext): void {
    const value = this._pendingValue;
    const { node, name } = this._part;
    const currentValue = node[name as keyof Element];

    if (!Object.is(currentValue, value)) {
      (node as any)[name] = value;
    }
  }

  rollback(_context: CommitContext): void {
    const { node, name, defaultValue } = this._part;
    (node as any)[name] = defaultValue;
  }
}
