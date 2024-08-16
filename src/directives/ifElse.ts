import {
  type Binding,
  type Directive,
  type DirectiveContext,
  type Part,
  type UpdateContext,
  directiveTag,
  nameOf,
  nameTag,
} from '../baseTypes.js';
import { resolveBinding } from '../binding.js';
import { ensureDirective } from '../error.js';
import { NoValue } from './noValue.js';

export function ifElse<TTrue, TFalse>(
  condition: boolean,
  trueCase: () => TTrue,
  falseCase: () => TFalse,
): IfElse<TTrue, TFalse> {
  return new IfElse(condition, trueCase, falseCase);
}

export function when<TTrue>(
  condition: boolean,
  trueCase: () => TTrue,
): IfElse<TTrue, NoValue> {
  return new IfElse(condition, trueCase, () => NoValue.instance);
}

export function unless<TFalse>(
  condition: boolean,
  falseCase: () => TFalse,
): IfElse<NoValue, TFalse> {
  return new IfElse(condition, () => NoValue.instance, falseCase);
}

export class IfElse<TTrue, TFalse> implements Directive<IfElse<TTrue, TFalse>> {
  private readonly _condition: boolean;

  private readonly _trueCase: () => TTrue;

  private readonly _falseCase: () => TFalse;

  constructor(
    condition: boolean,
    trueCase: () => TTrue,
    falseCase: () => TFalse,
  ) {
    this._condition = condition;
    this._trueCase = trueCase;
    this._falseCase = falseCase;
  }

  get condition(): boolean {
    return this._condition;
  }

  get trueCase(): () => TTrue {
    return this._trueCase;
  }

  get falseCase(): () => TFalse {
    return this._falseCase;
  }

  get [nameTag](): string {
    return (
      'IfElse(' +
      this._condition +
      ', ' +
      nameOf(this._condition ? this._trueCase() : this._falseCase()) +
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
    const { condition, trueCase, falseCase } = value;
    this._value = value;
    if (condition) {
      this._trueBinding = resolveBinding(trueCase(), part, context);
      this._falseBinding = null;
    } else {
      this._trueBinding = null;
      this._falseBinding = resolveBinding(falseCase(), part, context);
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
    return this._value.condition ? this._trueBinding! : this._falseBinding!;
  }

  connect(context: UpdateContext<unknown>): void {
    this.currentBinding.connect(context);
  }

  bind(newValue: IfElse<TTrue, TFalse>, context: UpdateContext<unknown>): void {
    DEBUG: {
      ensureDirective(IfElse, newValue, this.currentBinding.part);
    }

    const oldValue = this._value;
    const { condition, trueCase, falseCase } = newValue;

    if (oldValue.condition === condition) {
      if (condition) {
        this._trueBinding!.bind(trueCase(), context);
      } else {
        this._falseBinding!.bind(falseCase(), context);
      }
    } else {
      if (condition) {
        this._falseBinding!.unbind(context);
        if (this._trueBinding !== null) {
          this._trueBinding.bind(trueCase(), context);
        } else {
          this._trueBinding = resolveBinding(
            trueCase(),
            this._falseBinding!.part,
            context,
          );
          this._trueBinding.connect(context);
        }
      } else {
        this._trueBinding!.unbind(context);
        if (this._falseBinding !== null) {
          this._falseBinding.bind(falseCase(), context);
        } else {
          this._falseBinding = resolveBinding(
            falseCase(),
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
