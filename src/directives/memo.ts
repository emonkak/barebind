import {
  type Binding,
  type Directive,
  type DirectiveContext,
  type Part,
  type UpdateContext,
  directiveTag,
  nameOf,
  resolveBinding,
} from '../baseTypes.js';
import { dependenciesAreChanged } from '../compare.js';
import { ensureDirective } from '../error.js';

export function memo<T>(
  factory: () => T,
  dependencies: unknown[] | null,
): Memo<T> {
  return new Memo(factory, dependencies);
}

export class Memo<T> implements Directive<Memo<T>> {
  private readonly _factory: () => T;

  private readonly _dependencies: unknown[] | null;

  constructor(factory: () => T, dependencies: unknown[] | null) {
    this._factory = factory;
    this._dependencies = dependencies;
  }

  get factory(): () => T {
    return this._factory;
  }

  get dependencies(): unknown[] | null {
    return this._dependencies;
  }

  get [Symbol.toStringTag](): string {
    const factory = this._factory;
    return `Memo(${nameOf(factory())})`;
  }

  [directiveTag](part: Part, context: DirectiveContext): MemoBinding<T> {
    return new MemoBinding(this, part, context);
  }
}

export class MemoBinding<T> implements Binding<Memo<T>> {
  private _value: Memo<T>;

  private _memoizedDependencies: unknown[] | null = null;

  private readonly _binding: Binding<T>;

  constructor(value: Memo<T>, part: Part, context: DirectiveContext) {
    const { factory } = value;
    this._value = value;
    this._binding = resolveBinding(factory(), part, context);
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

  connect(context: UpdateContext): void {
    this._binding.connect(context);
    this._memoizedDependencies = this._value.dependencies;
  }

  bind(newValue: Memo<T>, context: UpdateContext): void {
    DEBUG: {
      ensureDirective(Memo, newValue, this._binding.part);
    }
    const oldDependencies = this._memoizedDependencies;
    const newDependencies = newValue.dependencies;
    if (dependenciesAreChanged(oldDependencies, newDependencies)) {
      this._binding.bind(newValue.factory(), context);
    }
    this._value = newValue;
    this._memoizedDependencies = newDependencies;
  }

  unbind(context: UpdateContext): void {
    this._binding.unbind(context);
    this._memoizedDependencies = null;
  }

  disconnect(context: UpdateContext): void {
    this._binding.disconnect(context);
    this._memoizedDependencies = null;
  }
}
