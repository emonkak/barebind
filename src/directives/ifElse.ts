import {
  type Binding,
  type Directive,
  type DirectiveContext,
  type Part,
  type UpdateContext,
  directiveTag,
  nameOf,
  nameTag,
  resolveBinding,
} from '../baseTypes.js';
import { ensureDirective } from '../error.js';
import { NoValue } from './noValue.js';

type Conditional<TTrue, TFalse> =
  | {
      condition: true;
      value: TTrue;
    }
  | {
      condition: false;
      value: TFalse;
    };

export function ifElse<TTrue, TFalse>(
  condition: boolean,
  trueCase: () => TTrue,
  falseCase: () => TFalse,
): IfElse<TTrue, TFalse> {
  const conditional: Conditional<TTrue, TFalse> = condition
    ? { condition: true, value: trueCase() }
    : { condition: false, value: falseCase() };
  return new IfElse(conditional);
}

export function when<TTrue>(
  condition: boolean,
  trueCase: () => TTrue,
): IfElse<TTrue, NoValue> {
  const conditional: Conditional<TTrue, NoValue> = condition
    ? { condition: true, value: trueCase() }
    : { condition: false, value: NoValue.instance };
  return new IfElse(conditional);
}

export function unless<TFalse>(
  condition: boolean,
  falseCase: () => TFalse,
): IfElse<NoValue, TFalse> {
  const conditional: Conditional<NoValue, TFalse> = condition
    ? { condition: true, value: NoValue.instance }
    : { condition: false, value: falseCase() };
  return new IfElse(conditional);
}

export class IfElse<TTrue, TFalse> implements Directive<IfElse<TTrue, TFalse>> {
  private readonly _conditional: Conditional<TTrue, TFalse>;

  constructor(conditional: Conditional<TTrue, TFalse>) {
    this._conditional = conditional;
  }

  get conditional(): Conditional<TTrue, TFalse> {
    return this._conditional;
  }

  get [nameTag](): string {
    return (
      'IfElse(' +
      this._conditional.condition +
      ', ' +
      nameOf(this._conditional.value) +
      ')'
    );
  }

  [directiveTag](
    part: Part,
    context: DirectiveContext,
  ): IfElseBinding<TTrue, TFalse> {
    return new IfElseBinding<TTrue, TFalse>(this, part, context);
  }
}

export class IfElseBinding<TTrue, TFalse>
  implements Binding<IfElse<TTrue, TFalse>>
{
  private _value: IfElse<TTrue, TFalse>;

  private _trueBinding: Binding<TTrue> | null = null;

  private _falseBinding: Binding<TFalse> | null = null;

  constructor(
    value: IfElse<TTrue, TFalse>,
    part: Part,
    context: DirectiveContext,
  ) {
    this._value = value;
    if (value.conditional.condition) {
      this._trueBinding = resolveBinding(
        value.conditional.value,
        part,
        context,
      );
      this._falseBinding = null;
    } else {
      this._trueBinding = null;
      this._falseBinding = resolveBinding(
        value.conditional.value,
        part,
        context,
      );
    }
  }

  get value(): IfElse<TTrue, TFalse> {
    return this._value;
  }

  get part(): Part {
    return this.currentBinding.part;
  }

  get startNode(): ChildNode {
    return this.currentBinding.startNode;
  }

  get endNode(): ChildNode {
    return this.currentBinding.endNode;
  }

  get currentBinding(): Binding<TTrue> | Binding<TFalse> {
    return this._value.conditional.condition
      ? this._trueBinding!
      : this._falseBinding!;
  }

  connect(context: UpdateContext): void {
    this.currentBinding.connect(context);
  }

  bind(newValue: IfElse<TTrue, TFalse>, context: UpdateContext): void {
    DEBUG: {
      ensureDirective([IfElse], newValue, this.currentBinding.part);
    }

    const oldConditional = this._value.conditional;
    const newConditional = newValue.conditional;

    if (oldConditional.condition === newConditional.condition) {
      if (newConditional.condition) {
        this._trueBinding!.bind(newConditional.value, context);
      } else {
        this._falseBinding!.bind(newConditional.value, context);
      }
    } else {
      if (newConditional.condition) {
        this._falseBinding!.unbind(context);
        if (this._trueBinding !== null) {
          this._trueBinding.bind(newConditional.value, context);
        } else {
          this._trueBinding = resolveBinding(
            newConditional.value,
            this._falseBinding!.part,
            context,
          );
          this._trueBinding.connect(context);
        }
      } else {
        this._trueBinding!.unbind(context);
        if (this._falseBinding !== null) {
          this._falseBinding.bind(newConditional.value, context);
        } else {
          this._falseBinding = resolveBinding(
            newConditional.value,
            this._trueBinding!.part,
            context,
          );
          this._falseBinding.connect(context);
        }
      }
    }

    this._value = newValue;
  }

  unbind(context: UpdateContext): void {
    this.currentBinding.unbind(context);
  }

  disconnect(context: UpdateContext): void {
    this.currentBinding.disconnect(context);
  }
}
