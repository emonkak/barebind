import { DirectiveError } from '../directive.js';
import {
  type DirectiveContext,
  type Part,
  PartType,
  type Primitive,
  type Slot,
  type UpdateSession,
} from '../internal.js';
import { PrimitiveBinding } from './primitive.js';

export type SpreadProps = { [key: string]: unknown };

export class SpreadPrimitive implements Primitive<SpreadProps> {
  static readonly instance: SpreadPrimitive = new SpreadPrimitive();

  ensureValue(value: unknown, part: Part): asserts value is SpreadProps {
    if (!isSpreadProps(value)) {
      throw new DirectiveError(
        this,
        value,
        part,
        'The value of SpreadPrimitive must be an object.',
      );
    }
  }

  resolveBinding(
    props: SpreadProps,
    part: Part,
    _context: DirectiveContext,
  ): SpreadBinding {
    if (part.type !== PartType.Element) {
      throw new DirectiveError(
        this,
        props,
        part,
        'SpreadPrimitive must be used in an element part.',
      );
    }
    return new SpreadBinding(props, part);
  }
}

export class SpreadBinding extends PrimitiveBinding<
  SpreadProps,
  Part.ElementPart
> {
  private _pendingSlots: Map<string, Slot<unknown>> = new Map();

  private _memoizedSlots: Map<string, Slot<unknown>> | null = null;

  get type(): Primitive<SpreadProps> {
    return SpreadPrimitive.instance;
  }

  shouldUpdate(props: SpreadProps): boolean {
    return this._memoizedSlots === null || props !== this._value;
  }

  override attach(session: UpdateSession): void {
    const { context } = session;
    const oldSlots = this._pendingSlots;
    const newSlots = new Map();

    for (const [key, slot] of oldSlots.entries()) {
      if (!Object.hasOwn(this._value, key) || this._value[key] === undefined) {
        slot.detach(session);
      }
    }

    for (const key of Object.keys(this._value)) {
      const prop = this._value[key];
      if (prop === undefined) {
        continue;
      }
      let slot = oldSlots.get(key);
      if (slot !== undefined) {
        slot.reconcile(prop, session);
      } else {
        const part = resolveNamedPart(key, this._part.node);
        slot = context.resolveSlot(prop, part);
        slot.attach(session);
      }
      newSlots.set(key, slot);
    }

    this._pendingSlots = newSlots;
  }

  override detach(session: UpdateSession): void {
    if (this._memoizedSlots !== null) {
      for (const slot of this._memoizedSlots.values()) {
        slot.detach(session);
      }
    }
  }

  commit(): void {
    if (this._memoizedSlots !== null) {
      for (const [name, slot] of this._memoizedSlots.entries()) {
        if (!this._pendingSlots.has(name)) {
          slot.rollback();
        }
      }
    }

    for (const binding of this._pendingSlots.values()) {
      binding.commit();
    }

    this._memoizedSlots = this._pendingSlots;
  }

  rollback(): void {
    if (this._memoizedSlots !== null) {
      for (const binding of this._memoizedSlots.values()) {
        binding.rollback();
      }

      this._memoizedSlots = null;
    }
  }
}

function isSpreadProps(value: unknown): value is SpreadProps {
  return value !== null && typeof value === 'object';
}

function resolveNamedPart(key: string, node: Element): Part {
  switch (key[0]) {
    case '$': {
      const name = key.slice(1);
      return {
        type: PartType.Live,
        node,
        name,
        defaultValue: node[name as keyof Element],
      };
    }
    case '.': {
      const name = key.slice(1);
      return {
        type: PartType.Property,
        node,
        name,
        defaultValue: node[name as keyof Element],
      };
    }
    case '@':
      return {
        type: PartType.Event,
        node,
        name: key.slice(1),
      };
    default:
      return {
        type: PartType.Attribute,
        node,
        name: key,
      };
  }
}
