import { DirectiveError } from '../directive.js';
import {
  type Binding,
  type DirectiveContext,
  type Part,
  PartType,
  type Primitive,
  type Slot,
  type UpdateSession,
} from '../internal.js';

export type SpreadProps = { [key: string]: unknown };

export const SpreadPrimitive: Primitive<SpreadProps> = {
  name: 'SpreadPrimitive',
  ensureValue(value: unknown, part: Part): asserts value is SpreadProps {
    if (!isSpreadProps(value)) {
      throw new DirectiveError(
        SpreadPrimitive,
        value,
        part,
        'The value of SpreadPrimitive must be an object.',
      );
    }
  },
  resolveBinding(
    props: SpreadProps,
    part: Part,
    _context: DirectiveContext,
  ): SpreadBinding {
    if (part.type !== PartType.Element) {
      throw new DirectiveError(
        SpreadPrimitive,
        props,
        part,
        'SpreadPrimitive must be used in an element part.',
      );
    }
    return new SpreadBinding(props, part);
  },
};

export class SpreadBinding implements Binding<SpreadProps> {
  private _props: SpreadProps;

  private readonly _part: Part.ElementPart;

  private _pendingSlots: Map<string, Slot<unknown>> = new Map();

  private _memoizedSlots: Map<string, Slot<unknown>> | null = null;

  constructor(props: SpreadProps, part: Part.ElementPart) {
    this._props = props;
    this._part = part;
  }

  get type(): Primitive<SpreadProps> {
    return SpreadPrimitive;
  }

  get value(): SpreadProps {
    return this._props;
  }

  get part(): Part.ElementPart {
    return this._part;
  }

  shouldBind(props: SpreadProps): boolean {
    return this._memoizedSlots === null || props !== this._props;
  }

  connect(session: UpdateSession): void {
    const { context } = session;
    const slots = new Map();

    for (const key of Object.keys(this._props)) {
      const value = this._props[key];
      if (value === undefined) {
        continue;
      }
      const part = resolveNamedPart(key, this._part.node);
      const slot = context.resolveSlot(value, part);
      slot.connect(session);
      slots.set(key, slot);
    }

    this._pendingSlots = slots;
    this._memoizedSlots = slots;
  }

  bind(props: SpreadProps, session: UpdateSession): void {
    const { context } = session;
    const oldSlots = this._pendingSlots;
    const newSlots = new Map();

    for (const [key, slot] of oldSlots.entries()) {
      if (!Object.hasOwn(props, key) || props[key] === undefined) {
        slot.disconnect(session);
      }
    }

    for (const key of Object.keys(props)) {
      const prop = props[key];
      if (prop === undefined) {
        continue;
      }
      let slot = oldSlots.get(key);
      if (slot !== undefined) {
        slot.reconcile(prop, session);
      } else {
        const part = resolveNamedPart(key, this._part.node);
        slot = context.resolveSlot(prop, part);
        slot.connect(session);
      }
      newSlots.set(key, slot);
    }

    this._props = props;
    this._pendingSlots = newSlots;
  }

  disconnect(session: UpdateSession): void {
    if (this._memoizedSlots !== null) {
      for (const slot of this._memoizedSlots.values()) {
        slot.disconnect(session);
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
