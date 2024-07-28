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

type Branch<T> = T extends Function ? () => T : (() => T) | T;

export function condition<TTrue, TFalse>(
  condition: boolean,
  trueBranch: Branch<TTrue>,
  falseBranch: Branch<TFalse>,
): Condition<TTrue, TFalse> {
  return new Condition(condition, trueBranch, falseBranch);
}

export function when<TTrue>(
  condition: boolean,
  trueBranch: Branch<TTrue>,
): Condition<TTrue, NoValue> {
  return new Condition(condition, trueBranch, NoValue.instance);
}

export function unless<TFalse>(
  condition: boolean,
  falseBranch: Branch<TFalse>,
): Condition<NoValue, TFalse> {
  return new Condition(condition, NoValue.instance, falseBranch);
}

export class Condition<TTrue, TFalse> implements Directive {
  private readonly _condition: boolean;

  private readonly _trueBranch: Branch<TTrue>;

  private readonly _falseBranch: Branch<TFalse>;

  constructor(
    condition: boolean,
    trueBranch: Branch<TTrue>,
    falseBranch: Branch<TFalse>,
  ) {
    this._condition = condition;
    this._trueBranch = trueBranch;
    this._falseBranch = falseBranch;
  }

  get condition(): boolean {
    return this._condition;
  }

  get trueBranch(): Branch<TTrue> {
    return this._trueBranch;
  }

  get falseBranch(): Branch<TFalse> {
    return this._falseBranch;
  }

  get [nameTag](): string {
    return (
      'Condition(' +
      this._condition +
      ', ' +
      nameOf(
        this._condition
          ? evalBranch(this._trueBranch)
          : evalBranch(this._falseBranch),
      ) +
      ')'
    );
  }

  [directiveTag](
    part: Part,
    updater: Updater,
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
    updater: Updater,
  ) {
    const { condition, trueBranch, falseBranch } = directive;
    this._directive = directive;
    if (condition) {
      this._trueBinding = resolveBinding(evalBranch(trueBranch), part, updater);
      this._falseBinding = null;
    } else {
      this._trueBinding = null;
      this._falseBinding = resolveBinding(
        evalBranch(falseBranch),
        part,
        updater,
      );
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

  connect(updater: Updater): void {
    this.currentBinding.connect(updater);
  }

  bind(newValue: Condition<TTrue, TFalse>, updater: Updater): void {
    DEBUG: {
      ensureDirective(Condition, newValue, this.currentBinding.part);
    }

    const oldValue = this._directive;
    const { condition, trueBranch, falseBranch } = newValue;

    if (oldValue.condition === condition) {
      if (condition) {
        this._trueBinding!.bind(evalBranch(trueBranch), updater);
      } else {
        this._falseBinding!.bind(evalBranch(falseBranch), updater);
      }
    } else {
      if (condition) {
        this._falseBinding!.unbind(updater);
        if (this._trueBinding !== null) {
          this._trueBinding.bind(evalBranch(trueBranch), updater);
        } else {
          this._trueBinding = resolveBinding(
            evalBranch(trueBranch),
            this._falseBinding!.part,
            updater,
          );
          this._trueBinding.connect(updater);
        }
      } else {
        this._trueBinding!.unbind(updater);
        if (this._falseBinding !== null) {
          this._falseBinding.bind(evalBranch(falseBranch), updater);
        } else {
          this._falseBinding = resolveBinding(
            evalBranch(falseBranch),
            this._trueBinding!.part,
            updater,
          );
          this._falseBinding.connect(updater);
        }
      }
    }

    this._directive = newValue;
  }

  unbind(updater: Updater): void {
    this.currentBinding.unbind(updater);
  }

  disconnect(): void {
    this.currentBinding.disconnect();
  }
}

function evalBranch<T>(branch: Branch<T>): T {
  return typeof branch === 'function' ? branch() : branch;
}
