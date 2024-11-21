import {
  type Binding,
  type ElementPart,
  type Part,
  PartType,
  type UpdateContext,
  resolveBinding,
} from '../baseTypes.js';
import { ensureNonDirective, reportPart, reportUsedValue } from '../error.js';

export type SpreadProps = { [key: string]: unknown };

export class ElementBinding implements Binding<SpreadProps> {
  private _value: SpreadProps;

  private readonly _part: ElementPart;

  private _bindings: Map<string, Binding<any>> = new Map();

  constructor(value: unknown, part: ElementPart) {
    DEBUG: {
      ensureSpreadProps(value, part);
      ensureNonDirective(value, part);
    }
    this._value = value;
    this._part = part;
  }

  get value(): SpreadProps {
    return this._value;
  }

  get part(): ElementPart {
    return this._part;
  }

  get startNode(): ChildNode {
    return this._part.node;
  }

  get endNode(): ChildNode {
    return this._part.node;
  }

  get bindings(): Map<string, Binding<any>> {
    return this._bindings;
  }

  connect(context: UpdateContext): void {
    this._updateProps(this._value, context);
  }

  bind(newValue: SpreadProps, context: UpdateContext): void {
    DEBUG: {
      ensureSpreadProps(newValue, this._part);
      ensureNonDirective(newValue, this._part);
    }
    this._updateProps(newValue, context);
    this._value = newValue;
  }

  unbind(context: UpdateContext): void {
    for (const binding of this._bindings.values()) {
      binding.unbind(context);
    }
  }

  disconnect(context: UpdateContext): void {
    for (const binding of this._bindings.values()) {
      binding.disconnect(context);
    }
  }

  private _updateProps(props: SpreadProps, context: UpdateContext): void {
    for (const [name, binding] of this._bindings.entries()) {
      if (!Object.hasOwn(props, name) || props[name] === undefined) {
        binding.unbind(context);
        this._bindings.delete(name);
      }
    }

    for (const name in props) {
      const value = props[name];
      if (value === undefined) {
        continue;
      }

      const binding = this._bindings.get(name);

      if (binding !== undefined) {
        binding.bind(value, context);
      } else {
        const part = resolveSpreadPart(name, this._part.node);
        const newBinding = resolveBinding(value, part, context);
        newBinding.connect(context);
        this._bindings.set(name, newBinding);
      }
    }
  }
}

function ensureSpreadProps(
  value: unknown,
  part: Part,
): asserts value is SpreadProps {
  if (!isSpreadProps(value)) {
    throw new Error(
      'The value of ElementBinding must be an object, but got "' +
        value +
        '".' +
        reportPart(part, reportUsedValue(value)),
    );
  }
}

function isSpreadProps(value: unknown): value is SpreadProps {
  return value !== null && typeof value === 'object';
}

function resolveSpreadPart(name: string, element: Element): Part {
  if (name.length > 1 && name[0] === '@') {
    return { type: PartType.Event, node: element, name: name.slice(1) };
  } else if (name.length > 1 && name[0] === '.') {
    return { type: PartType.Property, node: element, name: name.slice(1) };
  } else {
    return { type: PartType.Attribute, node: element, name };
  }
}
