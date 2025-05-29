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

class SpreadBinding implements Binding<SpreadProps> {
  private _props: SpreadProps;

  private readonly _part: ElementPart;

  private readonly _pendingBindings: Map<string, Binding<unknown>> = new Map();

  private _memoizedBindings: Map<string, Binding<unknown>> = new Map();

  private _dirty = true;

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

  bind(props: SpreadProps, context: UpdateContext): boolean {
    const dirty = props !== this._props;
    if (dirty) {
      this._props = props;
      this.connect(context);
    }
    return dirty;
  }

  connect(context: UpdateContext): void {
    for (const [name, binding] of this._pendingBindings.entries()) {
      if (!Object.hasOwn(this._props, name) || this._props[name] == null) {
        binding.disconnect(context);
        this._pendingBindings.delete(name);
      }
    }

    for (const name in this._props) {
      const value = this._props[name];
      if (value == null) {
        continue;
      }
      const oldBinding = this._pendingBindings.get(name);
      if (oldBinding !== undefined) {
        const newBinding = context.reconcileBinding(oldBinding, value);
        if (newBinding !== oldBinding) {
          this._pendingBindings.set(name, newBinding);
        }
        newBinding.connect(context);
      } else {
        const part = resolveNamedPart(name, this._part.node);
        const newBinding = context.resolveBinding(value, part);
        this._pendingBindings.set(name, newBinding);
        newBinding.connect(context);
      }
    }

    this._dirty = true;
  }

  disconnect(context: UpdateContext): void {
    for (const binding of this._memoizedBindings.values()) {
      binding.disconnect(context);
    }
    this._dirty = true;
  }

  commit(): void {
    if (!this._dirty) {
      return;
    }

    for (const [name, binding] of this._memoizedBindings.entries()) {
      if (binding !== this._pendingBindings.get(name)) {
        binding.rollback();
      }
    }
    for (const binding of this._pendingBindings.values()) {
      binding.commit();
    }

    this._memoizedBindings = new Map(this._pendingBindings);
    this._dirty = false;
  }

  rollback(): void {
    if (!this._dirty) {
      return;
    }

    if (this._memoizedBindings !== null) {
      for (const [name, binding] of this._memoizedBindings.entries()) {
        if (binding !== this._pendingBindings.get(name)) {
          binding.rollback();
        }
      }
    }

    this._memoizedBindings = new Map();
    this._dirty = false;
  }
}

function isSpreadProps(value: unknown): value is SpreadProps {
  return value !== null && typeof value === 'object';
}

function resolveNamedPart(name: string, node: Element): Part {
  switch (name[0]) {
    case '$':
      return {
        type: PartType.Live,
        node,
        name: name.slice(1),
      };
    case '.':
      return {
        type: PartType.Property,
        node,
        name: name.slice(1),
      };
    case '@':
      return {
        type: PartType.Event,
        node,
        name: name.slice(1),
      };
    default:
      return {
        type: PartType.Attribute,
        node,
        name,
      };
  }
}
