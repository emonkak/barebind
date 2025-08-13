import {
  type Binding,
  type CommitContext,
  type DirectiveContext,
  HydrationError,
  type HydrationTree,
  type Part,
  PartType,
  type Primitive,
  type Slot,
  type UpdateContext,
} from '../core.js';
import { debugPart } from '../debug/part.js';
import { debugValue, markUsedValue } from '../debug/value.js';
import { DirectiveSpecifier } from '../directive.js';

export type SpreadProperties = { [key: string]: unknown };

export const SpreadPrimitive: Primitive<SpreadProperties> = {
  name: 'SpreadPrimitive',
  ensureValue(value: unknown, part: Part): asserts value is SpreadProperties {
    if (!isSpreadProps(value)) {
      throw new Error(
        `The value of SpreadPrimitive must be an object, but got ${debugValue(value)}.\n` +
          debugPart(part, markUsedValue(value)),
      );
    }
  },
  resolveBinding(
    props: SpreadProperties,
    part: Part,
    _context: DirectiveContext,
  ): SpreadBinding {
    if (part.type !== PartType.Element) {
      throw new Error(
        'SpreadPrimitive must be used in an element part, but it is used here:\n' +
          debugPart(part, markUsedValue(new DirectiveSpecifier(this, props))),
      );
    }
    return new SpreadBinding(props, part);
  },
};

export class SpreadBinding implements Binding<SpreadProperties> {
  private _props: SpreadProperties;

  private readonly _part: Part.ElementPart;

  private _pendingSlots: Map<string, Slot<unknown>> = new Map();

  private _memoizedSlots: Map<string, Slot<unknown>> | null = null;

  constructor(props: SpreadProperties, part: Part.ElementPart) {
    this._props = props;
    this._part = part;
  }

  get type(): Primitive<SpreadProperties> {
    return SpreadPrimitive;
  }

  get value(): SpreadProperties {
    return this._props;
  }

  get part(): Part.ElementPart {
    return this._part;
  }

  shouldBind(props: SpreadProperties): boolean {
    return this._memoizedSlots === null || props !== this._props;
  }

  bind(props: SpreadProperties): void {
    this._props = props;
  }

  hydrate(tree: HydrationTree, context: UpdateContext): void {
    if (this._memoizedSlots !== null || this._pendingSlots.size > 0) {
      throw new HydrationError(
        'Hydration is failed because the binding has already been initialized.',
      );
    }

    const slots = new Map();

    for (const key of Object.keys(this._props)) {
      const value = this._props[key];
      if (value === undefined) {
        continue;
      }
      const part = resolveNamedPart(key, this._part.node);
      const slot = context.resolveSlot(value, part);
      slot.hydrate(tree, context);
      slots.set(key, slot);
    }

    this._pendingSlots = slots;
    this._memoizedSlots = slots;
  }

  connect(context: UpdateContext): void {
    const oldSlots = this._pendingSlots;
    const newSlots = new Map();

    for (const [key, slot] of oldSlots.entries()) {
      if (!Object.hasOwn(this._props, key) || this._props[key] === undefined) {
        slot.disconnect(context);
      }
    }

    for (const key of Object.keys(this._props)) {
      const value = this._props[key];
      if (value === undefined) {
        continue;
      }
      let slot = oldSlots.get(key);
      if (slot !== undefined) {
        slot.reconcile(value, context);
      } else {
        const part = resolveNamedPart(key, this._part.node);
        slot = context.resolveSlot(value, part);
        slot.connect(context);
      }
      newSlots.set(key, slot);
    }

    this._pendingSlots = newSlots;
  }

  disconnect(context: UpdateContext): void {
    if (this._memoizedSlots !== null) {
      for (const slot of this._memoizedSlots.values()) {
        slot.disconnect(context);
      }
    }
  }

  commit(context: CommitContext): void {
    if (this._memoizedSlots !== null) {
      for (const [name, slot] of this._memoizedSlots.entries()) {
        if (!this._pendingSlots.has(name)) {
          slot.rollback(context);
        }
      }
    }

    for (const binding of this._pendingSlots.values()) {
      binding.commit(context);
    }

    this._memoizedSlots = this._pendingSlots;
  }

  rollback(context: CommitContext): void {
    if (this._memoizedSlots !== null) {
      for (const binding of this._memoizedSlots.values()) {
        binding.rollback(context);
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
