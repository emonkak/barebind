import { resolveBinding } from '../binding.js';
import { dependenciesAreChanged } from '../compare.js';
import { ensureDirective } from '../error.js';
import {
  type Binding,
  type Directive,
  type Part,
  type UpdateContext,
  directiveTag,
  nameOf,
  nameTag,
} from '../types.js';

export function memo<T>(
  factory: () => T,
  dependencies: unknown[] | undefined,
): Memo<T> {
  return new Memo(factory, dependencies);
}

export class Memo<T> implements Directive {
  private readonly _factory: () => T;

  private readonly _dependencies: unknown[] | undefined;

  constructor(factory: () => T, dependencies: unknown[] | undefined) {
    this._factory = factory;
    this._dependencies = dependencies;
  }

  get factory(): () => T {
    return this._factory;
  }

  get dependencies(): unknown[] | undefined {
    return this._dependencies;
  }

  get [nameTag](): string {
    return 'Memo(' + nameOf(this._factory()) + ')';
  }

  [directiveTag](part: Part, context: UpdateContext<unknown>): MemoBinding<T> {
    return new MemoBinding(this, part, context);
  }
}

export class MemoBinding<T> implements Binding<Memo<T>> {
  private _value: Memo<T>;

  private readonly _binding: Binding<T>;

  constructor(value: Memo<T>, part: Part, context: UpdateContext<unknown>) {
    this._value = value;
    this._binding = resolveBinding(value.factory(), part, context);
  }

  get value(): Memo<T> {
    return this._value;
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

  get binding(): Binding<T> {
    return this._binding;
  }

  connect(context: UpdateContext<unknown>): void {
    this._binding.connect(context);
  }

  bind(newValue: Memo<T>, context: UpdateContext<unknown>): void {
    DEBUG: {
      ensureDirective(Memo, newValue, this._binding.part);
    }
    const oldDependencies = this._value.dependencies;
    const newDependencies = newValue.dependencies;
    if (dependenciesAreChanged(oldDependencies, newDependencies)) {
      this._value = newValue;
      this._binding.bind(newValue.factory(), context);
    }
  }

  unbind(context: UpdateContext<unknown>): void {
    this._value = new Memo(this._value.factory, undefined);
    this._binding.unbind(context);
  }

  disconnect(): void {
    this._value = new Memo(this._value.factory, undefined);
    this._binding.disconnect();
  }
}
