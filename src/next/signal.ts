import { nameOf } from './debug.js';
import { type HookProtocol, type UserHook, userHookTag } from './hook.js';
import { LinkedList } from './linkedList.js';

export type Subscriber = () => void;

export type Subscription = () => void;

export function atom<TValue>(value: TValue): Atom<TValue> {
  return new Atom(value);
}

export function computed<TResult, const TDependencies extends Signal<any>[]>(
  producer: (...dependencies: TDependencies) => TResult,
  dependencies: TDependencies,
): Computed<TResult, TDependencies> {
  return new Computed(producer, dependencies);
}

export abstract class Signal<TValue> implements UserHook<TValue> {
  abstract get value(): TValue;

  abstract get version(): number;

  get [Symbol.toStringTag](): string {
    return `Signal(${nameOf(this.value)})`;
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

  [userHookTag](context: HookProtocol): TValue {
    context.useLayoutEffect(
      () =>
        this.subscribe(() => {
          context.forceUpdate();
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

  constructor(value: TValue) {
    super();
    this._value = value;
  }

  get value(): TValue {
    return this._value;
  }

  set value(newValue: TValue) {
    this._value = newValue;
    this.notifySubscribers();
  }

  get version(): number {
    return this._version;
  }

  notifySubscribers(): void {
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
