import type { DirectiveContext, Primitive } from '../../core.js';
import { PrimitiveBinding } from '../../primitive.js';
import { ensurePartType } from '../error.js';
import { type DOMPart, PART_TYPE_LIVE } from '../part.js';
import type { DOMRenderer } from '../template.js';

export abstract class DOMLive {
  static resolveBinding<T>(
    value: T,
    part: DOMPart,
    _context: DirectiveContext<DOMPart, DOMRenderer>,
  ): DOMLiveBinding<T> {
    DEBUG: {
      ensurePartType(PART_TYPE_LIVE, DOMLive, value, part);
    }
    return new DOMLiveBinding(value, part);
  }
}

export class DOMLiveBinding<T> extends PrimitiveBinding<
  T,
  DOMPart.Live,
  DOMRenderer
> {
  get type(): Primitive<T, DOMPart.Live> {
    return DOMLive;
  }

  shouldUpdate(_newValue: T): boolean {
    return true;
  }

  override commit(): void {
    const value = this._pendingValue;
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
