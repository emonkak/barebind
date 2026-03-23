import {
  type DirectiveContext,
  PART_TYPE_ELEMENT,
  type Part,
  type Primitive,
  type Session,
} from '../core.js';
import { DirectiveError } from '../error.js';
import {
  createAttributePart,
  createEventPart,
  createLivePart,
  createPropertyPart,
  ensurePartType,
} from '../part.js';
import { Slot } from '../slot.js';
import { isObject, PrimitiveBinding } from './primitive.js';

export type SpreadProps = { [key: string]: unknown };

export abstract class SpreadType {
  static ensureValue(value: unknown, part: Part): asserts value is SpreadProps {
    if (!isObject(value)) {
      throw new DirectiveError(
        this,
        value,
        part,
        'SpreadType values must be object.',
      );
    }
  }

  static resolveBinding(
    value: SpreadProps,
    part: Part,
    _context: DirectiveContext,
  ): SpreadBinding {
    DEBUG: {
      ensurePartType(PART_TYPE_ELEMENT, this, value, part);
    }
    return new SpreadBinding(value, part);
  }
}

export class SpreadBinding extends PrimitiveBinding<
  SpreadProps,
  Part.ElementPart
> {
  private _pendingSlots: Map<string, Slot<unknown>> = new Map();

  private _currentSlots: Map<string, Slot<unknown>> | null = null;

  get type(): Primitive<SpreadProps> {
    return SpreadType;
  }

  shouldUpdate(value: SpreadProps): boolean {
    return this._currentSlots === null || value !== this._pendingValue;
  }

  override attach(session: Session): void {
    const { context } = session;
    const oldSlots = this._currentSlots;
    const newSlots = new Map();

    if (oldSlots !== null) {
      for (const [key, slot] of oldSlots.entries()) {
        if (
          this._pendingValue[key] === undefined ||
          !Object.hasOwn(this._pendingValue, key)
        ) {
          slot.detach(session);
        }
      }
    }

    for (const key of Object.keys(this._pendingValue)) {
      const prop = this._pendingValue[key];
      if (prop === undefined) {
        continue;
      }
      let slot = oldSlots?.get(key);
      if (slot !== undefined) {
        slot.reconcile(prop, session);
      } else {
        const part = resolveNamedPart(key, this._part.node);
        slot = Slot.place(prop, part, context);
        slot.attach(session);
      }
      newSlots.set(key, slot);
    }

    this._pendingSlots = newSlots;
  }

  override detach(session: Session): void {
    if (this._currentSlots !== null) {
      for (const slot of this._currentSlots.values()) {
        slot.detach(session);
      }
    }
  }

  override commit(): void {
    if (this._currentSlots !== null) {
      for (const [name, slot] of this._currentSlots.entries()) {
        if (!this._pendingSlots.has(name)) {
          slot.rollback();
        }
      }
    }

    for (const binding of this._pendingSlots.values()) {
      binding.commit();
    }

    this._currentSlots = this._pendingSlots;
  }

  override rollback(): void {
    if (this._currentSlots !== null) {
      for (const binding of this._currentSlots.values()) {
        binding.rollback();
      }

      this._currentSlots = null;
    }
  }
}

function resolveNamedPart(key: string, node: Element): Part {
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
