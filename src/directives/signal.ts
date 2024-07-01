import {
  type Binding,
  type Directive,
  directiveTag,
  ensureDirective,
  resolveBinding,
} from '../binding.js';
import { LinkedList } from '../linkedList.js';
import {
  type RenderingContext,
  type UsableObject,
  usableTag,
} from '../renderingContext.js';
import type { Part, Updater } from '../types.js';

export type Subscriber = () => void;

export type Subscription = () => void;

type UnwrapSignals<TValue> = TValue extends any[]
  ? {
      [P in keyof TValue]: TValue[P] extends Signal<infer Value>
        ? Value
        : never;
    }
  : never;

export function atom<TValue>(value: TValue): AtomSignal<TValue> {
  return new AtomSignal(value);
}

export function compute<TResult, const TDependencies extends Signal<any>[]>(
  producer: (...dependencies: TDependencies) => TResult,
  dependencies: TDependencies,
): ComputedSignal<TResult, TDependencies> {
  return new ComputedSignal(producer, dependencies);
}

export function map<TResult, const TDependencies extends Signal<any>[]>(
  producer: (...values: UnwrapSignals<TDependencies>) => TResult,
  dependencies: TDependencies,
): ComputedSignal<TResult, TDependencies> {
  return new ComputedSignal((...dependencies) => {
    const values = dependencies.map(
      (dependency) => dependency.value,
    ) as UnwrapSignals<TDependencies>;
    return producer(...values);
  }, dependencies);
}

export abstract class Signal<TValue>
  implements Directive, UsableObject<TValue, RenderingContext>
{
  abstract get value(): TValue;

  abstract get version(): number;

  abstract subscribe(subscriber: Subscriber): Subscription;

  map<TResult>(
    selector: (value: TValue) => TResult,
  ): ProjectedSignal<TValue, TResult> {
    return new ProjectedSignal(this, selector);
  }

  scan<TResult>(
    accumulator: (result: TResult, value: TValue) => TResult,
    seed: TResult,
  ): ScannedSignal<TValue, TResult> {
    return new ScannedSignal(this, accumulator, seed);
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

  [usableTag](context: RenderingContext): TValue {
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

export class AtomSignal<TValue> extends Signal<TValue> {
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
    this.forceUpdate();
  }

  get version(): number {
    return this._version;
  }

  forceUpdate() {
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

export class ComputedSignal<
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

export class ProjectedSignal<TValue, TResult> extends Signal<TResult> {
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

export class ScannedSignal<TValue, TResult> extends Signal<TResult> {
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

  bind(newValue: Signal<TValue>, updater: Updater) {
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
