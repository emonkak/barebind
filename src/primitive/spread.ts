import { formatPart } from '../debug/part.js';
import { formatValue, markUsedValue } from '../debug/value.js';
import { DirectiveSpecifier } from '../directive.js';
import {
  type Binding,
  type DirectiveContext,
  HydrationError,
  type HydrationTree,
  type Part,
  PartType,
  type Primitive,
  type Slot,
  type UpdateSession,
} from '../internal.js';

export type SpreadProperties = { [key: string]: unknown };

export const SpreadPrimitive: Primitive<SpreadProperties> = {
  name: 'SpreadPrimitive',
  ensureValue(value: unknown, part: Part): asserts value is SpreadProperties {
    if (!isSpreadProps(value)) {
      throw new Error(
        `The value of SpreadPrimitive must be an object, but got ${formatValue(value)}.\n` +
          formatPart(part, markUsedValue(value)),
      );
    }
  },
  resolveBinding(
    props: SpreadProperties,
    part: Part,
    _session: DirectiveContext,
  ): SpreadBinding {
    if (part.type !== PartType.Element) {
      throw new Error(
        'SpreadPrimitive must be used in an element part, but it is used here:\n' +
          formatPart(part, markUsedValue(new DirectiveSpecifier(this, props))),
      );
    }
    return new SpreadBinding(props, part);
  },
};

export class SpreadBinding implements Binding<SpreadProperties> {
  value: SpreadProperties;

  readonly part: Part.ElementPart;

  private _pendingSlots: Map<string, Slot<unknown>> = new Map();

  private _memoizedSlots: Map<string, Slot<unknown>> | null = null;

  constructor(value: SpreadProperties, part: Part.ElementPart) {
    this.value = value;
    this.part = part;
  }

  get type(): Primitive<SpreadProperties> {
    return SpreadPrimitive;
  }

  shouldBind(value: SpreadProperties): boolean {
    return this._memoizedSlots === null || value !== this.value;
  }

  hydrate(target: HydrationTree, session: UpdateSession): void {
    if (this._memoizedSlots !== null || this._pendingSlots.size > 0) {
      throw new HydrationError(
        'Hydration is failed because the binding has already been initialized.',
      );
    }

    const { context } = session;
    const slots = new Map();

    for (const key of Object.keys(this.value)) {
      const value = this.value[key];
      if (value === undefined) {
        continue;
      }
      const part = resolveNamedPart(key, this.part.node);
      const slot = context.resolveSlot(value, part);
      slot.hydrate(target, session);
      slots.set(key, slot);
    }

    this._pendingSlots = slots;
    this._memoizedSlots = slots;
  }

  connect(session: UpdateSession): void {
    const { context } = session;
    const oldSlots = this._pendingSlots;
    const newSlots = new Map();

    for (const [key, slot] of oldSlots.entries()) {
      if (!Object.hasOwn(this.value, key) || this.value[key] === undefined) {
        slot.disconnect(session);
      }
    }

    for (const key of Object.keys(this.value)) {
      const value = this.value[key];
      if (value === undefined) {
        continue;
      }
      let slot = oldSlots.get(key);
      if (slot !== undefined) {
        slot.reconcile(value, session);
      } else {
        const part = resolveNamedPart(key, this.part.node);
        slot = context.resolveSlot(value, part);
        slot.connect(session);
      }
      newSlots.set(key, slot);
    }

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

function isSpreadProps(value: unknown): value is SpreadProperties {
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
