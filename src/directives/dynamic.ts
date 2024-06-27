import {
  type Binding,
  type Directive,
  directiveTag,
  ensureDirective,
  isDirective,
  resolveBinding,
  resolvePrimitiveBinding,
} from '../binding.js';
import type { Part, Updater } from '../types.js';

export function dynamic(value: unknown): DynamicDirective {
  return new DynamicDirective(value);
}

export class DynamicDirective implements Directive {
  private readonly _value: unknown;

  constructor(value: unknown) {
    this._value = value;
  }

  get value(): unknown {
    return this._value;
  }

  [directiveTag](part: Part, updater: Updater): DynamicBinding {
    return new DynamicBinding(this, part, updater);
  }
}

export class DynamicBinding implements Binding<unknown> {
  private _directive: DynamicDirective;

  private _binding: Binding<unknown>;

  constructor(directive: DynamicDirective, part: Part, updater: Updater) {
    this._directive = directive;
    this._binding = resolveBinding(directive.value, part, updater);
  }

  get value(): DynamicDirective {
    return this._directive;
  }

  get part(): Part {
    return this._binding.part;
  }

  get startNode(): ChildNode {
    return this._binding.startNode;
  }

  get endNode(): ChildNode {
    return this._binding.endNode;
  }

  get binding(): Binding<unknown> {
    return this._binding;
  }

  connect(updater: Updater): void {
    this._binding.connect(updater);
  }

  bind(newValue: DynamicDirective, updater: Updater): void {
    DEBUG: {
      ensureDirective(DynamicDirective, newValue);
    }
    const oldDynamic = this._binding.value;
    const newDynamic = newValue.value;
    if (isDirective(newDynamic)) {
      if (isDirective(oldDynamic) && isSamePrototype(oldDynamic, newDynamic)) {
        this._binding.bind(newDynamic, updater);
      } else {
        this._binding.unbind(updater);
        this._binding = newDynamic[directiveTag](this._binding.part, updater);
        this._binding.connect(updater);
      }
    } else {
      if (isDirective(oldDynamic)) {
        this._binding.unbind(updater);
        this._binding = resolvePrimitiveBinding(newDynamic, this._binding.part);
        this._binding.connect(updater);
      } else {
        this._binding.bind(newDynamic, updater);
      }
    }
  }

  unbind(updater: Updater): void {
    this._binding.unbind(updater);
  }

  disconnect(): void {
    this._binding.disconnect();
  }
}

function isSamePrototype(first: {}, second: {}): boolean {
  return Object.getPrototypeOf(first) === Object.getPrototypeOf(second);
}
