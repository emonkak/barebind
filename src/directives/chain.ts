import {
  type Binding,
  type Directive,
  type DirectiveContext,
  type Part,
  type UpdateContext,
  directiveTag,
  resolveBinding,
} from '../baseTypes.js';
import { ensureDirective, nameOf } from '../debug.js';

export function chain<TFirst, TSecond>(
  first: TFirst,
  second: TSecond,
): Chain<TFirst, TSecond> {
  return new Chain(first, second);
}

export class Chain<TFirst, TSecond>
  implements Directive<Chain<TFirst, TSecond>>
{
  private readonly _first: TFirst;

  private readonly _second: TSecond;

  constructor(first: TFirst, second: TSecond) {
    this._first = first;
    this._second = second;
  }

  get first(): TFirst {
    return this._first;
  }

  get second(): TSecond {
    return this._second;
  }

  get [Symbol.toStringTag](): string {
    return `Chain(${nameOf(this._first)}, ${nameOf(this._second)})`;
  }

  [directiveTag](
    part: Part,
    context: DirectiveContext,
  ): ChainBinding<TFirst, TSecond> {
    return new ChainBinding(this, part, context);
  }
}

export class ChainBinding<TFirst, TSecond>
  implements Binding<Chain<TFirst, TSecond>>
{
  private _value: Chain<TFirst, TSecond>;

  private readonly _firstBinding: Binding<TFirst>;

  private readonly _secondBinding: Binding<TSecond>;

  constructor(
    value: Chain<TFirst, TSecond>,
    part: Part,
    context: DirectiveContext,
  ) {
    this._value = value;
    this._firstBinding = resolveBinding(value.first, part, context);
    this._secondBinding = resolveBinding(value.second, part, context);
  }

  get value(): Chain<TFirst, TSecond> {
    return this._value;
  }

  get part(): Part {
    return this._firstBinding.part;
  }

  get startNode(): ChildNode {
    return this._firstBinding.startNode;
  }

  get endNode(): ChildNode {
    return this._secondBinding.endNode;
  }

  get firstBinding(): Binding<TFirst> {
    return this._firstBinding;
  }

  get secondBinding(): Binding<TSecond> {
    return this._secondBinding;
  }

  connect(context: UpdateContext): void {
    this._firstBinding.connect(context);
    this._secondBinding.connect(context);
  }

  bind(newValue: Chain<TFirst, TSecond>, context: UpdateContext): void {
    DEBUG: {
      ensureDirective(Chain, newValue, this._firstBinding.part);
    }
    this._firstBinding.bind(newValue.first, context);
    this._secondBinding.bind(newValue.second, context);
    this._value = newValue;
  }

  unbind(context: UpdateContext): void {
    // Unbind in reverse order.
    this._secondBinding.unbind(context);
    this._firstBinding.unbind(context);
  }

  disconnect(context: UpdateContext): void {
    // Disconnect in reverse order.
    this._secondBinding.disconnect(context);
    this._firstBinding.disconnect(context);
  }
}
