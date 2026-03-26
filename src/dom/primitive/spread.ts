import type { DirectiveContext, Primitive, Session } from '../../core.js';
import { isObject, PrimitiveBinding } from '../../primitive.js';
import { Slot } from '../../slot.js';
import { DirectiveError, ensurePartType } from '../error.js';
import {
  createAttributePart,
  createEventPart,
  createLivePart,
  createPropertyPart,
  type DOMPart,
  PART_TYPE_ELEMENT,
} from '../part.js';
import type { DOMRenderer } from '../template.js';

export type SpreadProps = { [key: string]: unknown };

export abstract class DOMSpread {
  static ensureValue(
    value: unknown,
    part: DOMPart,
  ): asserts value is SpreadProps {
    if (!isObject(value)) {
      throw new DirectiveError(
        DOMSpread,
        value,
        part,
        'Spread values must be object.',
      );
    }
  }

  static resolveBinding(
    props: SpreadProps,
    part: DOMPart,
    _context: DirectiveContext<DOMPart, DOMRenderer>,
  ): DOMSpreadBinding {
    DEBUG: {
      ensurePartType(PART_TYPE_ELEMENT, DOMSpread, props, part);
    }
    return new DOMSpreadBinding(props, part);
  }
}

export class DOMSpreadBinding extends PrimitiveBinding<
  SpreadProps,
  DOMPart.Element,
  DOMRenderer
> {
  private _pendingSlots: Map<string, Slot<unknown, DOMPart, DOMRenderer>> =
    new Map();

  private _currentValue: SpreadProps | null = null;

  private _currentSlots: Map<
    string,
    Slot<unknown, DOMPart, DOMRenderer>
  > | null = null;

  get type(): Primitive<SpreadProps, DOMPart.Element> {
    return DOMSpread;
  }

  shouldUpdate(newProps: SpreadProps): boolean {
    return this._currentValue === null || newProps !== this._currentValue;
  }

  override attach(session: Session<DOMPart, DOMRenderer>): void {
    const { context } = session;
    const oldSlots = this._currentSlots;
    const newSlots = new Map();

    if (oldSlots !== null) {
      for (const [key, slot] of oldSlots.entries()) {
        if (!Object.hasOwn(this._pendingValue, key)) {
          slot.detach(session);
        }
      }
    }

    for (const key of Object.keys(this._pendingValue)) {
      const prop = this._pendingValue[key];
      let slot = oldSlots?.get(key);
      if (slot !== undefined) {
        slot.update(prop, session);
      } else {
        const part = resolveNamedPart(key, this._part.node);
        slot = Slot.place(prop, part, context);
        slot.attach(session);
      }
      newSlots.set(key, slot);
    }

    this._pendingSlots = newSlots;
  }

  override detach(session: Session<DOMPart, DOMRenderer>): void {
    for (const slot of this._pendingSlots.values()) {
      slot.detach(session);
    }
  }

  override commit(): void {
    const oldSlots = this._currentSlots;
    const newSlots = this._pendingSlots;

    if (oldSlots !== null) {
      for (const [name, slot] of oldSlots) {
        if (!newSlots.has(name)) {
          slot.rollback();
        }
      }
    }

    for (const binding of newSlots.values()) {
      binding.commit();
    }

    this._currentValue = this._pendingValue;
    this._currentSlots = this._pendingSlots;
  }

  override rollback(): void {
    if (this._currentSlots !== null) {
      for (const binding of this._currentSlots.values()) {
        binding.rollback();
      }
    }

    this._currentValue = null;
    this._currentSlots = null;
  }
}

function resolveNamedPart(key: string, node: Element): DOMPart {
  switch (key[0]) {
    case '$':
      return createLivePart(node, key.slice(1));
    case '.':
      return createPropertyPart(node, key.slice(1));
    case '@':
      return createEventPart(node, key.slice(1));
    default:
      return createAttributePart(node, key);
  }
}
