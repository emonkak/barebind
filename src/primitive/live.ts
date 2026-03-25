import type { DirectiveContext, Primitive } from '../core.js';
import { DOM_PART_TYPE_LIVE, type DOMPart, ensurePartType } from '../dom.js';
import { PrimitiveBinding } from './primitive.js';

export abstract class LiveType {
  static resolveBinding<T>(
    value: T,
    part: DOMPart,
    _context: DirectiveContext,
  ): LiveBinding<T> {
    DEBUG: {
      ensurePartType(DOM_PART_TYPE_LIVE, this, value, part);
    }
    return new LiveBinding(value, part);
  }
}

export class LiveBinding<T> extends PrimitiveBinding<T, DOMPart.LivePart> {
  get type(): Primitive<T, DOMPart.LivePart> {
    return LiveType;
  }

  shouldUpdate(_value: T): boolean {
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
