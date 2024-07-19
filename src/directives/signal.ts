import { resolveBinding } from '../binding.js';
import { LinkedList } from '../linkedList.js';
import {
  type RenderContext,
  type UsableObject,
  usableTag,
} from '../renderContext.js';
import {
  type Binding,
  type Directive,
  type Part,
  type Updater,
  directiveTag,
  ensureDirective,
} from '../types.js';

export type Subscriber = () => void;

export type Subscription = () => void;

export abstract class Signal<TValue>
  implements Directive, UsableObject<TValue, RenderContext>
{
  abstract get value(): TValue;

  abstract get version(): number;

  abstract subscribe(subscriber: Subscriber): Subscription;

  map<TResult>(
    selector: (value: TValue) => TResult,
  ): Projected<TValue, TResult> {
    return new Projected(this, selector);
  }

  scan<TResult>(
    accumulator: (result: TResult, value: TValue) => TResult,
    seed: TResult,
  ): Scanned<TValue, TResult> {
    return new Scanned(this, accumulator, seed);
  }

  toJSON(): TValue {
    return this.value;
  }

  valueOf(): TValue {
    return this.value;
  }

  [directiveTag](part: Part, updater: Updater): SignalBinding<TValue> {
    return new SignalBinding(this, part, updater);
  }

  [usableTag](context: RenderContext): TValue {
    context.useEffect(
      () =>
        this.subscribe(() => {
          context.requestUpdate();
        }),
      [this],
    );
    return this.value;
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
    const node = this._subscribers.pushBack(subscriber);
    return () => {
      this._subscribers.remove(node);
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

export class Scanned<TValue, TResult> extends Signal<TResult> {
  private readonly _signal: Signal<TValue>;

  private readonly _accumulator: (result: TResult, value: TValue) => TResult;

  private _memoizedResult: TResult;

  private _memoizedVersion: number;

  constructor(
    signal: Signal<TValue>,
    accumulator: (result: TResult, value: TValue) => TResult,
    seed: TResult,
  ) {
    super();
    this._signal = signal;
    this._accumulator = accumulator;
    this._memoizedResult = accumulator(seed, signal.value);
    this._memoizedVersion = signal.version;
  }

  get value(): TResult {
    const { version } = this._signal;
    if (this._memoizedVersion < version) {
      const accumulator = this._accumulator;
      this._memoizedResult = accumulator(
        this._memoizedResult,
        this._signal.value,
      );
      this._memoizedVersion = version;
    }
    return this._memoizedResult;
  }

  get version(): number {
    return this._signal.version;
  }

  subscribe(subscriber: Subscriber): Subscription {
    return this._signal.subscribe(subscriber);
  }
}

export class SignalBinding<TValue> implements Binding<Signal<TValue>> {
  private _signal: Signal<TValue>;

  private readonly _binding: Binding<TValue>;

  private _subscription: Subscription | null = null;

  constructor(signal: Signal<TValue>, part: Part, updater: Updater) {
    this._signal = signal;
    this._binding = resolveBinding(signal.value, part, updater);
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

  connect(updater: Updater): void {
    this._binding.connect(updater);
    this._subscription ??= this._subscribeSignal(this._signal, updater);
  }

  bind(newValue: Signal<TValue>, updater: Updater): void {
    DEBUG: {
      ensureDirective(Signal, newValue);
    }
    if (this._signal !== newValue) {
      this._signal = newValue;
      this._subscription?.();
      this._subscription = null;
    }
    this._binding.bind(newValue.value, updater);
    this._subscription ??= this._subscribeSignal(newValue, updater);
  }

  unbind(updater: Updater): void {
    this._binding.unbind(updater);
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
    updater: Updater,
  ): Subscription {
    return signal.subscribe(() => {
      this._binding.bind(signal.value, updater);
      updater.scheduleUpdate();
    });
  }
}
