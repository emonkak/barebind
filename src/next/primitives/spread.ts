import type {
  Binding,
  DirectiveContext,
  Primitive,
  Slot,
  UpdateContext,
} from '../core.js';
import { inspectPart, inspectValue, markUsedValue } from '../debug.js';
import type { HydrationTree } from '../hydration.js';
import { type ElementPart, type Part, PartType } from '../part.js';

export type SpreadProps = { [key: string]: unknown };

export const SpreadPrimitive: Primitive<SpreadProps> = {
  name: 'SpreadPrimitive',
  ensureValue(value: unknown, part: Part): asserts value is SpreadProps {
    if (!isSpreadProps(value)) {
      throw new Error(
        `The value of SpreadPrimitive must be Object, but got ${inspectValue(value)}.\n` +
          inspectPart(part, markUsedValue(value)),
      );
    }
  },
  resolveBinding(
    props: SpreadProps,
    part: Part,
    _context: DirectiveContext,
  ): SpreadBinding {
    if (part.type !== PartType.Element) {
      throw new Error(
        'SpreadPrimitive must be used in an element part, but it is used here:\n' +
          inspectPart(part, markUsedValue(props)),
      );
    }
    return new SpreadBinding(props, part);
  },
};

class SpreadBinding implements Binding<SpreadProps> {
  private _props: SpreadProps;

  private readonly _part: ElementPart;

  private readonly _pendingSlots: Map<string, Slot<unknown>> = new Map();

  private _memoizedSlots: Map<string, Slot<unknown>> | null = null;

  constructor(props: SpreadProps, part: ElementPart) {
    this._props = props;
    this._part = part;
  }

  get directive(): Primitive<SpreadProps> {
    return SpreadPrimitive;
  }

  get value(): SpreadProps {
    return this._props;
  }

  get part(): ElementPart {
    return this._part;
  }

  shouldBind(props: SpreadProps): boolean {
    return this._memoizedSlots === null || props !== this._props;
  }

  bind(props: SpreadProps): void {
    this._props = props;
  }

  hydrate(_hydrationTree: HydrationTree, _context: UpdateContext): void {}

  connect(context: UpdateContext): void {
    for (const [key, slot] of this._pendingSlots.entries()) {
      if (!Object.hasOwn(this._props, key) || this._props[key] === undefined) {
        slot.disconnect(context);
        this._pendingSlots.delete(key);
      }
    }

    for (const key in this._props) {
      const value = this._props[key];
      if (value === undefined) {
        continue;
      }
      let slot = this._pendingSlots.get(key);
      if (slot !== undefined) {
        slot.reconcile(this._props[key]!, context);
      } else {
        const part = resolveNamedPart(key, this._part.node);
        slot = context.resolveSlot(value, part);
        slot.connect(context);
      }
    }
  }

  disconnect(context: UpdateContext): void {
    if (this._memoizedSlots !== null) {
      for (const slot of this._memoizedSlots.values()) {
        slot.disconnect(context);
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

    this._memoizedSlots = new Map(this._pendingSlots);
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
    case '$':
      return {
        type: PartType.Live,
        node,
        name: key.slice(1),
      };
    case '.':
      return {
        type: PartType.Property,
        node,
        name: key.slice(1),
      };
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
