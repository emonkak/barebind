import type { CommitContext, DirectiveContext, Primitive } from '../core.js';
import { inspectPart, markUsedValue } from '../debug.js';
import { DirectiveSpecifier } from '../directive.js';
import { type LivePart, type Part, PartType } from '../part.js';
import { PrimitiveBinding } from './primitive.js';

export const LivePrimitive: Primitive<any> = {
  name: 'LivePrimitive',
  resolveBinding<T>(
    value: T,
    part: Part,
    _context: DirectiveContext,
  ): LiveBinding<T> {
    if (part.type !== PartType.Live) {
      throw new Error(
        'LivePrimitive must be used in a live part, but it is used here:\n' +
          inspectPart(part, markUsedValue(new DirectiveSpecifier(this, value))),
      );
    }
    return new LiveBinding(value, part);
  },
};

export class LiveBinding<T> extends PrimitiveBinding<T, LivePart> {
  get type(): Primitive<T> {
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
