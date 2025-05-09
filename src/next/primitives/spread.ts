import {
  type Binding,
  type DirectiveProtocol,
  type EffectProtocol,
  type UpdateProtocol,
  resolveBindingTag,
} from '../coreTypes.js';
import { inspectPart, inspectValue, markUsedValue } from '../debug.js';
import { type ElementPart, type Part, PartType } from '../part.js';
import type { Primitive } from './primitive.js';

export type SpreadValue = { [key: string]: unknown };

export const SpreadPrimitive: Primitive<SpreadValue> = {
  ensureValue(value: unknown, part: Part): asserts value is SpreadValue {
    if (!isSpreadProps(value)) {
      throw new Error(
        `The value of spread primitive must be Object, but got "${inspectValue(value)}".\n` +
          inspectPart(part, markUsedValue(value)),
      );
    }
  },
  [resolveBindingTag](
    value: SpreadValue,
    part: Part,
    _context: DirectiveProtocol,
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
  private _value: SpreadValue;

  private readonly _part: ElementPart;

  private readonly _pendingBindings: Map<string, Binding<any>> = new Map();

  private _memoizedBindings: Map<string, Binding<any>> = new Map();

  constructor(value: SpreadValue, part: ElementPart) {
    this._value = value;
    this._part = part;
  }

  get directive(): Primitive<SpreadValue> {
    return SpreadPrimitive;
  }

  get value(): SpreadValue {
    return this._value;
  }

  get part(): ElementPart {
    return this._part;
  }

  connect(context: UpdateProtocol): void {
    this._reconcileBindings(this._value, context);
  }

  bind(newValue: SpreadValue, context: UpdateProtocol): void {
    this._reconcileBindings(newValue, context);
    this._value = newValue;
  }

  unbind(context: UpdateProtocol): void {
    for (const binding of this._memoizedBindings.values()) {
      binding.unbind(context);
    }
  }

  disconnect(context: UpdateProtocol): void {
    for (const binding of this._memoizedBindings.values()) {
      binding.disconnect(context);
    }
  }

  commit(context: EffectProtocol): void {
    for (const [name, binding] of this._memoizedBindings.entries()) {
      if (!this._pendingBindings.has(name)) {
        binding.commit(context);
      }
    }
    for (const binding of this._pendingBindings.values()) {
      binding.commit(context);
    }
    this._memoizedBindings = new Map(this._pendingBindings);
  }

  private _reconcileBindings(
    props: SpreadValue,
    context: UpdateProtocol,
  ): void {
    for (const [name, binding] of this._pendingBindings.entries()) {
      if (!Object.hasOwn(props, name) || props[name] === undefined) {
        binding.unbind(context);
        this._pendingBindings.delete(name);
      }
    }

    for (const name in props) {
      const value = props[name];
      if (value === undefined) {
        continue;
      }
      const binding = this._pendingBindings.get(name);
      if (binding !== undefined) {
        const newBinding = context.reconcileBinding(binding, value);
        if (newBinding !== binding) {
          this._pendingBindings.set(name, newBinding);
        }
      } else {
        const part = resolveNamedPart(name, this._part.node);
        const newBinding = context.resolveBinding(value, part);
        newBinding.connect(context);
        this._pendingBindings.set(name, newBinding);
      }
    }
  }
}

function isSpreadProps(value: unknown): value is SpreadValue {
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
