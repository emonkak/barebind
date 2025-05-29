import { inspectPart, inspectValue, markUsedValue } from '../debug.js';
import type { Binding, DirectiveContext, UpdateContext } from '../directive.js';
import { type ElementPart, type Part, PartType } from '../part.js';
import type { Primitive } from './primitive.js';

export type SpreadProps = { [key: string]: unknown };

export const SpreadPrimitive: Primitive<SpreadProps> = {
  get name(): string {
    return 'SpreadPrimitive';
  },
  ensureValue(value: unknown, part: Part): asserts value is SpreadProps {
    if (!isSpreadProps(value)) {
      throw new Error(
        `The value of spread primitive must be Object, but got ${inspectValue(value)}.\n` +
          inspectPart(part, markUsedValue(value)),
      );
    }
  },
  resolveBinding(
    value: SpreadProps,
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

export class SpreadBinding implements Binding<SpreadProps> {
  private _props: SpreadProps;

  private readonly _part: ElementPart;

  private _pendingBindings: Map<string, Binding<unknown>>;

  private _memoizedBindings: Map<string, Binding<unknown>>;

  constructor(props: SpreadProps, part: ElementPart) {
    this._props = props;
    this._part = part;
    this._pendingBindings = this._memoizedBindings = new Map();
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

  bind(props: SpreadProps, context: UpdateContext): boolean {
    const dirty = props !== this._props;
    if (dirty) {
      this._props = props;
      this.connect(context);
    }
    return dirty;
  }

  connect(context: UpdateContext): void {
    const nextBindings = new Map(this._pendingBindings);

    for (const [key, binding] of nextBindings.entries()) {
      if (!Object.hasOwn(this._props, key) || this._props[key] == null) {
        binding.disconnect(context);
        nextBindings.delete(key);
      }
    }

    for (const key in this._props) {
      const value = this._props[key];
      if (value == null) {
        continue;
      }
      const binding = nextBindings.get(key);
      if (binding !== undefined) {
        binding.bind(this._props[key]!, context);
      } else {
        const part = resolveNamedPart(key, this._part.node);
        const newBinding = context.resolveBinding(value, part);
        newBinding.connect(context);
        this._pendingBindings.set(key, newBinding);
      }
    }

    this._pendingBindings = nextBindings;
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

    this._memoizedBindings = this._pendingBindings;
  }

  rollback(): void {
    for (const binding of this._memoizedBindings.values()) {
      binding.rollback();
    }

    this._memoizedBindings = new Map();
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
