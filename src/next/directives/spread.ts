import { inspectPart, inspectValue, markUsedValue } from '../debug.js';
import type { Binding, DirectiveContext, UpdateContext } from '../directive.js';
import { type ElementPart, type Part, PartType } from '../part.js';
import type { Primitive } from './primitive.js';

export type SpreadValue = { [key: string]: unknown };

export const SpreadPrimitive: Primitive<SpreadValue> = {
  get name(): string {
    return 'SpreadPrimitive';
  },
  ensureValue(value: unknown, part: Part): asserts value is SpreadValue {
    if (!isSpreadProps(value)) {
      throw new Error(
        `The value of spread primitive must be Object, but got ${inspectValue(value)}.\n` +
          inspectPart(part, markUsedValue(value)),
      );
    }
  },
  resolveBinding(
    value: SpreadValue,
    part: Part,
    _context: DirectiveContext,
  ): SpreadBinding {
    if (part.type !== PartType.Element) {
      throw new Error(
        'Spread primitive must be used in an element part, but it is used here:\n' +
          inspectPart(part, markUsedValue(this)),
      );
    }
    return new SpreadBinding(value, part);
  },
};

export class SpreadBinding implements Binding<SpreadValue> {
  private _props: SpreadValue;

  private readonly _part: ElementPart;

  private readonly _pendingBindings: Map<string, Binding<unknown>> = new Map();

  private _memoizedBindings: Map<string, Binding<unknown>> = new Map();

  constructor(props: SpreadValue, part: ElementPart) {
    this._props = props;
    this._part = part;
  }

  get directive(): Primitive<SpreadValue> {
    return SpreadPrimitive;
  }

  get value(): SpreadValue {
    return this._props;
  }

  get part(): ElementPart {
    return this._part;
  }

  shouldBind(props: SpreadValue): boolean {
    return props !== this._props;
  }

  bind(props: SpreadValue, _context: UpdateContext): void {
    this._props = props;
  }

  connect(context: UpdateContext): void {
    for (const [key, binding] of this._pendingBindings.entries()) {
      if (!Object.hasOwn(this._props, key) || this._props[key] == null) {
        binding.disconnect(context);
        this._pendingBindings.delete(key);
      }
    }

    for (const key in this._props) {
      const value = this._props[key];
      if (value == null) {
        continue;
      }
      let binding = this._pendingBindings.get(key);
      if (binding !== undefined) {
        binding.bind(this._props[key]!, context);
      } else {
        const part = resolveNamedPart(key, this._part.node);
        binding = context.resolveBinding(value, part);
        binding.connect(context);
      }
    }
  }

  disconnect(context: UpdateContext): void {
    for (const binding of this._memoizedBindings.values()) {
      binding.disconnect(context);
    }
  }

  commit(): void {
    for (const [name, binding] of this._memoizedBindings.entries()) {
      if (!this._pendingBindings.has(name)) {
        binding.rollback();
      }
    }

    for (const binding of this._pendingBindings.values()) {
      binding.commit();
    }

    this._memoizedBindings = new Map(this._pendingBindings);
  }

  rollback(): void {
    for (const binding of this._memoizedBindings.values()) {
      binding.rollback();
    }

    this._memoizedBindings = new Map();
  }
}

function isSpreadProps(value: unknown): value is SpreadValue {
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
