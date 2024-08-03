import {
  type Binding,
  type Directive,
  type Part,
  type UpdateContext,
  directiveTag,
  nameOf,
  nameTag,
} from '../baseTypes.js';
import { resolveBinding } from '../binding.js';
import { ensureDirective } from '../error.js';
import { NoValue } from './noValue.js';

export function condition<TTrue, TFalse>(
  condition: boolean,
  trueBranch: () => TTrue,
  falseBranch: () => TFalse,
): Condition<TTrue, TFalse> {
  return new Condition(condition, trueBranch, falseBranch);
}

export function when<TTrue>(
  condition: boolean,
  trueBranch: () => TTrue,
): Condition<TTrue, NoValue> {
  return new Condition(condition, trueBranch, () => NoValue.instance);
}

export function unless<TFalse>(
  condition: boolean,
  falseBranch: () => TFalse,
): Condition<NoValue, TFalse> {
  return new Condition(condition, () => NoValue.instance, falseBranch);
}

export class Condition<TTrue, TFalse>
  implements Directive<Condition<TTrue, TFalse>>
{
  private readonly _condition: boolean;

  private readonly _trueBranch: () => TTrue;

  private readonly _falseBranch: () => TFalse;

  constructor(
    condition: boolean,
    trueBranch: () => TTrue,
    falseBranch: () => TFalse,
  ) {
    this._condition = condition;
    this._trueBranch = trueBranch;
    this._falseBranch = falseBranch;
  }

  get condition(): boolean {
    return this._condition;
  }

  get trueBranch(): () => TTrue {
    return this._trueBranch;
  }

  get falseBranch(): () => TFalse {
    return this._falseBranch;
  }

  get [nameTag](): string {
    return (
      'Condition(' +
      this._condition +
      ', ' +
      nameOf(this._condition ? this._trueBranch() : this._falseBranch()) +
      ')'
    );
  }

  [directiveTag](
    part: Part,
    context: UpdateContext<unknown>,
  ): ConditionBinding<TTrue, TFalse> {
    return new ConditionBinding<TTrue, TFalse>(this, part, context);
  }
}

export class ConditionBinding<TTrue, TFalse>
  implements Binding<Condition<TTrue, TFalse>>
{
  private _value: Condition<TTrue, TFalse>;

  private _trueBinding: Binding<TTrue> | null = null;

  private _falseBinding: Binding<TFalse> | null = null;

  constructor(
    value: Condition<TTrue, TFalse>,
    part: Part,
    context: UpdateContext<unknown>,
  ) {
    const { condition, trueBranch, falseBranch } = value;
    this._value = value;
    if (condition) {
      this._trueBinding = resolveBinding(trueBranch(), part, context);
      this._falseBinding = null;
    } else {
      this._trueBinding = null;
      this._falseBinding = resolveBinding(falseBranch(), part, context);
    }
  }

  get value(): Condition<TTrue, TFalse> {
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
    return this._value.condition ? this._trueBinding! : this._falseBinding!;
  }

  connect(context: UpdateContext<unknown>): void {
    this.currentBinding.connect(context);
  }

  bind(
    newValue: Condition<TTrue, TFalse>,
    context: UpdateContext<unknown>,
  ): void {
    DEBUG: {
      ensureDirective(Condition, newValue, this.currentBinding.part);
    }

    const oldValue = this._value;
    const { condition, trueBranch, falseBranch } = newValue;

    if (oldValue.condition === condition) {
      if (condition) {
        this._trueBinding!.bind(trueBranch(), context);
      } else {
        this._falseBinding!.bind(falseBranch(), context);
      }
    } else {
      if (condition) {
        this._falseBinding!.unbind(context);
        if (this._trueBinding !== null) {
          this._trueBinding.bind(trueBranch(), context);
        } else {
          this._trueBinding = resolveBinding(
            trueBranch(),
            this._falseBinding!.part,
            context,
          );
          this._trueBinding.connect(context);
        }
      } else {
        this._trueBinding!.unbind(context);
        if (this._falseBinding !== null) {
          this._falseBinding.bind(falseBranch(), context);
        } else {
          this._falseBinding = resolveBinding(
            falseBranch(),
            this._trueBinding!.part,
            context,
          );
          this._falseBinding.connect(context);
        }
      }
    }

    this._value = newValue;
  }

  unbind(context: UpdateContext<unknown>): void {
    this.currentBinding.unbind(context);
  }

  disconnect(): void {
    this.currentBinding.disconnect();
  }
}
