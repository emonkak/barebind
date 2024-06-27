import {
  type Binding,
  type Directive,
  directiveTag,
  ensureDirective,
  resolveBinding,
} from '../binding.js';
import type { Part, Updater } from '../types.js';
import { UnitDirective } from './unit.js';

type FunctionOrValue<T> = T extends Function ? () => T : (() => T) | T;

export function condition<TTrue, TFalse>(
  condition: boolean,
  trueCase: FunctionOrValue<TTrue>,
  falseCase: FunctionOrValue<TFalse>,
): ConditionDirective<TTrue, TFalse> {
  return new ConditionDirective(condition, trueCase, falseCase);
}

export function when<TTrue>(
  condition: boolean,
  trueCase: FunctionOrValue<TTrue>,
): ConditionDirective<TTrue, UnitDirective> {
  return new ConditionDirective(condition, trueCase, UnitDirective.instance);
}

export function unless<TFalse>(
  condition: boolean,
  falseCase: FunctionOrValue<TFalse>,
): ConditionDirective<UnitDirective, TFalse> {
  return new ConditionDirective(condition, UnitDirective.instance, falseCase);
}

export class ConditionDirective<TTrue, TFalse> implements Directive {
  private readonly _condition: boolean;

  private readonly _trueCase: FunctionOrValue<TTrue>;

  private readonly _falseCase: FunctionOrValue<TFalse>;

  constructor(
    condition: boolean,
    trueCase: FunctionOrValue<TTrue>,
    falseCase: FunctionOrValue<TFalse>,
  ) {
    this._condition = condition;
    this._trueCase = trueCase;
    this._falseCase = falseCase;
  }

  get condition(): boolean {
    return this._condition;
  }

  get trueCase(): FunctionOrValue<TTrue> {
    return this._trueCase;
  }

  get falseCase(): FunctionOrValue<TFalse> {
    return this._falseCase;
  }

  [directiveTag](
    part: Part,
    updater: Updater,
  ): ConditionBinding<TTrue, TFalse> {
    return new ConditionBinding<TTrue, TFalse>(this, part, updater);
  }
}

export class ConditionBinding<TTrue, TFalse>
  implements Binding<ConditionDirective<TTrue, TFalse>>
{
  private _directive: ConditionDirective<TTrue, TFalse>;

  private _trueBinding: Binding<TTrue> | null = null;

  private _falseBinding: Binding<TFalse> | null = null;

  constructor(
    directive: ConditionDirective<TTrue, TFalse>,
    part: Part,
    updater: Updater,
  ) {
    const { condition, trueCase, falseCase } = directive;
    this._directive = directive;
    if (condition) {
      this._trueBinding = resolveBinding(
        evalFunctionOrValue(trueCase),
        part,
        updater,
      );
      this._falseBinding = null;
    } else {
      this._trueBinding = null;
      this._falseBinding = resolveBinding(
        evalFunctionOrValue(falseCase),
        part,
        updater,
      );
    }
  }

  get value(): ConditionDirective<TTrue, TFalse> {
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

  bind(newValue: ConditionDirective<TTrue, TFalse>, updater: Updater): void {
    DEBUG: {
      ensureDirective(ConditionDirective, newValue);
    }

    const oldValue = this._directive;
    const { condition, trueCase, falseCase } = newValue;

    if (oldValue.condition === condition) {
      if (condition) {
        this._trueBinding!.bind(evalFunctionOrValue(trueCase), updater);
      } else {
        this._falseBinding!.bind(evalFunctionOrValue(falseCase), updater);
      }
    } else {
      if (condition) {
        this._falseBinding!.unbind(updater);
        if (this._trueBinding !== null) {
          this._trueBinding.bind(evalFunctionOrValue(trueCase), updater);
        } else {
          this._trueBinding = resolveBinding(
            evalFunctionOrValue(trueCase),
            this._falseBinding!.part,
            updater,
          );
          this._trueBinding.connect(updater);
        }
      } else {
        this._trueBinding!.unbind(updater);
        if (this._falseBinding !== null) {
          this._falseBinding.bind(evalFunctionOrValue(falseCase), updater);
        } else {
          this._falseBinding = resolveBinding(
            evalFunctionOrValue(falseCase),
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

function evalFunctionOrValue<T>(functionOrValue: FunctionOrValue<T>): T {
  return typeof functionOrValue === 'function'
    ? functionOrValue()
    : functionOrValue;
}
