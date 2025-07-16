import type {
  Binding,
  CommitContext,
  DirectiveContext,
  Primitive,
  Slot,
  UpdateContext,
} from '../core.js';
import { inspectPart, inspectValue, markUsedValue } from '../debug.js';
import type { HydrationTree } from '../hydration.js';
import { type ElementPart, type Part, PartType } from '../part.js';

export type SpreadProperties = { [key: string]: unknown };

export const SpreadPrimitive: Primitive<SpreadProperties> = {
  name: 'SpreadPrimitive',
  ensureValue(value: unknown, part: Part): asserts value is SpreadProperties {
    if (!isSpreadProps(value)) {
      throw new Error(
        `The value of SpreadPrimitive must be object, but got ${inspectValue(value)}.\n` +
          inspectPart(part, markUsedValue(value)),
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
          inspectPart(part, markUsedValue(props)),
      );
    }
    return new SpreadBinding(props, part);
  },
};

export class SpreadBinding implements Binding<SpreadProperties> {
  private _props: SpreadProperties;

  private readonly _part: ElementPart;

  private _pendingSlots: Map<string, Slot<unknown>> = new Map();

  private _memoizedSlots: Map<string, Slot<unknown>> | null = null;

  constructor(props: SpreadProperties, part: ElementPart) {
    this._props = props;
    this._part = part;
  }

  get type(): Primitive<SpreadProperties> {
    return SpreadPrimitive;
  }

  get value(): SpreadProperties {
    return this._props;
  }

  get part(): ElementPart {
    return this._part;
  }

  shouldBind(props: SpreadProperties): boolean {
    return this._memoizedSlots === null || props !== this._props;
  }

  bind(props: SpreadProperties): void {
    this._props = props;
  }

  hydrate(_hydrationTree: HydrationTree, _context: UpdateContext): void {}

  connect(context: UpdateContext): void {
    const nextSlots = new Map(this._pendingSlots);

    for (const [key, slot] of nextSlots.entries()) {
      if (!Object.hasOwn(this._props, key) || this._props[key] === undefined) {
        slot.disconnect(context);
        nextSlots.delete(key);
      }
    }

    for (const key of Object.keys(this._props)) {
      const value = this._props[key];
      if (value === undefined) {
        continue;
      }
      let slot = nextSlots.get(key);
      if (slot !== undefined) {
        slot.reconcile(value, context);
      } else {
        const part = resolveNamedPart(key, this._part.node);
        slot = context.resolveSlot(value, part);
        slot.connect(context);
        nextSlots.set(key, slot);
      }
    }

    this._pendingSlots = nextSlots;
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
