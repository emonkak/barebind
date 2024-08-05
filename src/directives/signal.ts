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
import { LinkedList } from '../linkedList.js';
import {
  type RenderContext,
  type UsableObject,
  usableTag,
} from '../renderContext.js';

export type Subscriber = () => void;

export type Subscription = () => void;

export abstract class Signal<TValue>
  implements Directive<Signal<TValue>>, UsableObject<TValue, RenderContext>
{
  abstract get value(): TValue;

  abstract get version(): number;

  get [nameTag](): string {
    return 'Signal(' + nameOf(this.value) + ')';
  }

  abstract subscribe(subscriber: Subscriber): Subscription;

  map<TResult>(
    selector: (value: TValue) => TResult,
  ): Projected<TValue, TResult> {
    return new Projected(this, selector);
  }

  toJSON(): TValue {
    return this.value;
  }

  valueOf(): TValue {
    return this.value;
  }

  [directiveTag](part: Part, context: DirectiveContext): SignalBinding<TValue> {
    return new SignalBinding(this, part, context);
  }

  [usableTag](context: RenderContext): TValue {
    context.useEffect(
      () =>
        this.subscribe(() => {
          context.forceUpdate();
        }),
      [this],
    );
    return this.value;
  }
}

export class SignalBinding<TValue> implements Binding<Signal<TValue>> {
  private _signal: Signal<TValue>;

  private readonly _binding: Binding<TValue>;

  private _subscription: Subscription | null = null;

  constructor(signal: Signal<TValue>, part: Part, context: DirectiveContext) {
    this._signal = signal;
    this._binding = resolveBinding(signal.value, part, context);
  }

  get value(): Signal<TValue> {
    return this._signal;
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

  get binding(): Binding<TValue> {
    return this._binding;
  }

  connect(context: UpdateContext<unknown>): void {
    this._binding.connect(context);
    this._subscription ??= this._subscribeSignal(this._signal, context);
  }

  bind(newValue: Signal<TValue>, context: UpdateContext<unknown>): void {
    DEBUG: {
      ensureDirective(Signal, newValue, this._binding.part);
    }
    if (this._signal !== newValue) {
      this._subscription?.();
      this._subscription = null;
      this._signal = newValue;
    }
    this._binding.bind(newValue.value, context);
    this._subscription ??= this._subscribeSignal(newValue, context);
  }

  unbind(context: UpdateContext<unknown>): void {
    this._binding.unbind(context);
    this._subscription?.();
    this._subscription = null;
  }

  disconnect(): void {
    this._binding.disconnect();
    this._subscription?.();
    this._subscription = null;
  }

  private _subscribeSignal(
    signal: Signal<TValue>,
    context: UpdateContext<unknown>,
  ): Subscription {
    return signal.subscribe(() => {
      this._binding.bind(signal.value, context);
      context.scheduleUpdate();
    });
  }
}

export class Atom<TValue> extends Signal<TValue> {
  private _value: TValue;

  private _version = 0;

  private readonly _subscribers = new LinkedList<Subscriber>();

  constructor(initialValue: TValue) {
    super();
    this._value = initialValue;
  }

  get value(): TValue {
    return this._value;
  }

  set value(newValue: TValue) {
    this._value = newValue;
    this.notifyUpdate();
  }

  get version(): number {
    return this._version;
  }

  notifyUpdate(): void {
    this._version += 1;
    for (
      let node = this._subscribers.front();
      node !== null;
      node = node.next
    ) {
      const subscriber = node.value;
      subscriber();
    }
  }

  setUntrackedValue(newValue: TValue): void {
    this._value = newValue;
  }

  subscribe(subscriber: Subscriber): Subscription {
    const nodeRef = this._subscribers.pushBack(subscriber);
    return () => {
      this._subscribers.remove(nodeRef);
    };
  }
}

export class Computed<
  TResult,
  const TDependencies extends Signal<any>[],
> extends Signal<TResult> {
  private readonly _producer: (...signals: TDependencies) => TResult;

  private readonly _dependencies: TDependencies;

  private _memoizedValue: TResult | null = null;

  private _memoizedVersion = -1; // -1 is indicated an uninitialized signal.

  constructor(
    producer: (...dependencies: TDependencies) => TResult,
    dependencies: TDependencies,
  ) {
    super();
    this._producer = producer;
    this._dependencies = dependencies;
  }

  get value(): TResult {
    const { version } = this;
    if (this._memoizedVersion < version) {
      const producer = this._producer;
      this._memoizedVersion = version;
      this._memoizedValue = producer(...this._dependencies);
    }
    return this._memoizedValue!;
  }

  get version(): number {
    const dependencies = this._dependencies;
    let version = 0;
    for (let i = 0, l = dependencies.length; i < l; i++) {
      version += dependencies[i]!.version;
    }
    return version;
  }

  subscribe(subscriber: Subscriber): Subscription {
    const subscriptions = this._dependencies.map((dependency) =>
      dependency.subscribe(subscriber),
    );
    return () => {
      for (let i = 0, l = subscriptions.length; i < l; i++) {
        subscriptions[i]!();
      }
    };
  }
}

export class Projected<TValue, TResult> extends Signal<TResult> {
  private readonly _signal: Signal<TValue>;

  private readonly _selector: (value: TValue) => TResult;

  constructor(signal: Signal<TValue>, selector: (value: TValue) => TResult) {
    super();
    this._signal = signal;
    this._selector = selector;
  }

  get value(): TResult {
    const selector = this._selector;
    return selector(this._signal.value)!;
  }

  get version(): number {
    return this._signal.version;
  }

  subscribe(subscriber: Subscriber): Subscription {
    return this._signal.subscribe(subscriber);
  }
}
