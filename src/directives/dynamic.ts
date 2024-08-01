import { resolveBinding, resolvePrimitiveBinding } from '../binding.js';
import { ensureDirective } from '../error.js';
import {
  type Binding,
  type Directive,
  type Part,
  type UpdateContext,
  directiveTag,
  isDirective,
  nameOf,
  nameTag,
} from '../types.js';

export function dynamic(value: unknown): Dynamic {
  return new Dynamic(value);
}

export class Dynamic implements Directive {
  private readonly _value: unknown;

  constructor(value: unknown) {
    this._value = value;
  }

  get value(): unknown {
    return this._value;
  }

  get [nameTag](): string {
    return 'Dynamic(' + nameOf(this._value) + ')';
  }

  [directiveTag](part: Part, context: UpdateContext<unknown>): DynamicBinding {
    return new DynamicBinding(this, part, context);
  }
}

export class DynamicBinding implements Binding<unknown> {
  private _directive: Dynamic;

  private _binding: Binding<any>;

  constructor(directive: Dynamic, part: Part, context: UpdateContext<unknown>) {
    this._directive = directive;
    this._binding = resolveBinding(directive.value, part, context);
  }

  get value(): Dynamic {
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

  connect(context: UpdateContext<unknown>): void {
    this._binding.connect(context);
  }

  bind(newValue: Dynamic, context: UpdateContext<unknown>): void {
    DEBUG: {
      ensureDirective(Dynamic, newValue, this._binding.part);
    }
    const oldDynamic = this._binding.value;
    const newDynamic = newValue.value;
    if (isDirective(newDynamic)) {
      if (isDirective(oldDynamic) && isInstanceOf(oldDynamic, newDynamic)) {
        this._binding.bind(newDynamic, context);
      } else {
        this._binding.unbind(context);
        this._binding = newDynamic[directiveTag](this._binding.part, context);
        this._binding.connect(context);
      }
    } else {
      if (isDirective(oldDynamic)) {
        this._binding.unbind(context);
        this._binding = resolvePrimitiveBinding(newDynamic, this._binding.part);
        this._binding.connect(context);
      } else {
        this._binding.bind(newDynamic, context);
      }
    }
  }

  unbind(context: UpdateContext<unknown>): void {
    this._binding.unbind(context);
  }

  disconnect(): void {
    this._binding.disconnect();
  }
}

function isInstanceOf(base: {}, target: {}): boolean {
  return Object.prototype.isPrototypeOf.call(
    Object.getPrototypeOf(base),
    target,
  );
}
