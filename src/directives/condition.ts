import { resolveBinding } from '../binding.js';
import { ensureDirective } from '../error.js';
import {
  type Binding,
  type Directive,
  type Part,
  type Updater,
  directiveTag,
  nameOf,
  nameTag,
} from '../types.js';
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

export class Condition<TTrue, TFalse> implements Directive {
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
    updater: Updater<unknown>,
  ): ConditionBinding<TTrue, TFalse> {
    return new ConditionBinding<TTrue, TFalse>(this, part, updater);
  }
}

export class ConditionBinding<TTrue, TFalse>
  implements Binding<Condition<TTrue, TFalse>>
{
  private _directive: Condition<TTrue, TFalse>;

  private _trueBinding: Binding<TTrue> | null = null;

  private _falseBinding: Binding<TFalse> | null = null;

  constructor(
    directive: Condition<TTrue, TFalse>,
    part: Part,
    updater: Updater<unknown>,
  ) {
    const { condition, trueBranch, falseBranch } = directive;
    this._directive = directive;
    if (condition) {
      this._trueBinding = resolveBinding(trueBranch(), part, updater);
      this._falseBinding = null;
    } else {
      this._trueBinding = null;
      this._falseBinding = resolveBinding(falseBranch(), part, updater);
    }
  }

  get value(): Condition<TTrue, TFalse> {
    return this._directive;
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

  get currentBinding(): Binding<TTrue | TFalse> {
    return this._directive.condition ? this._trueBinding! : this._falseBinding!;
  }

  connect(updater: Updater<unknown>): void {
    this.currentBinding.connect(updater);
  }

  bind(newValue: Condition<TTrue, TFalse>, updater: Updater<unknown>): void {
    DEBUG: {
      ensureDirective(Condition, newValue, this.currentBinding.part);
    }

    const oldValue = this._directive;
    const { condition, trueBranch, falseBranch } = newValue;

    if (oldValue.condition === condition) {
      if (condition) {
        this._trueBinding!.bind(trueBranch(), updater);
      } else {
        this._falseBinding!.bind(falseBranch(), updater);
      }
    } else {
      if (condition) {
        this._falseBinding!.unbind(updater);
        if (this._trueBinding !== null) {
          this._trueBinding.bind(trueBranch(), updater);
        } else {
          this._trueBinding = resolveBinding(
            trueBranch(),
            this._falseBinding!.part,
            updater,
          );
          this._trueBinding.connect(updater);
        }
      } else {
        this._trueBinding!.unbind(updater);
        if (this._falseBinding !== null) {
          this._falseBinding.bind(falseBranch(), updater);
        } else {
          this._falseBinding = resolveBinding(
            falseBranch(),
            this._trueBinding!.part,
            updater,
          );
          this._falseBinding.connect(updater);
        }
      }
    }

    this._directive = newValue;
  }

  unbind(updater: Updater<unknown>): void {
    this.currentBinding.unbind(updater);
  }

  disconnect(): void {
    this.currentBinding.disconnect();
  }
}
