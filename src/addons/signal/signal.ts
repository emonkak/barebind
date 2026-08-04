import { type Bindable, toElement, type VElement } from '../../base.js';
import { is } from '../../compare.js';
import {
  createComponent,
  type HookObject,
  type RenderContext,
} from '../../component.js';
import { LinkedList } from './linked-list.js';

export type InvalidateEvent<T = unknown> =
  | InvalidateEvent.DeleteEvent<T>
  | InvalidateEvent.SetEvent<T>;

export namespace InvalidateEvent {
  export interface DeleteEvent<T = unknown> {
    readonly type: 'delete';
    readonly source: Signal<T>;
    readonly path: PropertyKey[];
  }

  export interface SetEvent<T = unknown> {
    readonly type: 'set';
    readonly source: Signal<T>;
    readonly path: PropertyKey[];
    readonly oldValue: T;
    readonly newValue: T;
  }
}

export type Subscriber = (event: InvalidateEvent) => void;

export type Unsubscribe = () => void;

export type UnwrapSignals<T> = {
  [K in keyof T]: T[K] extends Signal<infer V> ? V : never;
};

const SignalObserver = createComponent(function SignalObserver({
  signal,
}: {
  signal: Signal<any>;
}) {
  return this.use(signal);
});

export abstract class Signal<T> implements Bindable, HookObject<T> {
  abstract get value(): T;

  abstract get version(): number;

  [toElement](): VElement {
    return SignalObserver({ signal: this });
  }

  map<TResult>(
    selector: (value: T) => TResult,
  ): Computed<TResult, [Signal<T>]> {
    return new Computed<TResult, [Signal<T>]>(selector, [this]);
  }

  abstract subscribe(subscriber: Subscriber): Unsubscribe;

  onUse(context: RenderContext): T {
    const version = this.version;
    const snapshot = context.useMemo(() => ({ version }), [this]);

    context.useEffect(() => {
      snapshot.version = version;
      if (version < this.version) {
        context.forceUpdate();
      }
    }, [this, version]);

    context.useEffect(() => {
      let batched = true;
      const checkForChanges = () => {
        if (snapshot.version < this.version) {
          context.forceUpdate();
        }
        batched = false;
      };
      queueMicrotask(checkForChanges);
      return this.subscribe(() => {
        if (!batched) {
          batched = true;
          queueMicrotask(checkForChanges);
        }
      });
    }, [this]);

    return this.value;
  }
}

export abstract class WritableSignal<T> extends Signal<T> {
  protected _version: number = 0;
  private readonly _subscribers = new LinkedList<Subscriber>();

  get value(): T {
    return this.read();
  }

  set value(newValue: T) {
    const oldValue = this.read();
    if (!is(oldValue, newValue)) {
      this.write(newValue);
      this.invalidate({
        type: 'set',
        source: this,
        path: [],
        oldValue,
        newValue,
      });
    }
  }

  get version(): number {
    return this._version;
  }

  invalidate<T>(event: InvalidateEvent<T>): void {
    this._version++;
    for (const subscriber of this._subscribers) {
      subscriber(event as InvalidateEvent<unknown>);
    }
  }

  subscribe(subscriber: Subscriber): Unsubscribe {
    const node = this._subscribers.append(subscriber);
    return () => {
      this._subscribers.delete(node);
    };
  }

  abstract read(): T;

  abstract write(value: T): void;
}

export class Accessor<T> extends WritableSignal<T> {
  private readonly _getter: () => T;
  private readonly _setter: (value: T) => void;

  constructor(getter: () => T, setter: (value: T) => void) {
    super();
    this._getter = getter;
    this._setter = setter;
  }

  read(): T {
    const get = this._getter;
    return get();
  }

  write(value: T): void {
    const set = this._setter;
    set(value);
  }
}

export class Atom<T> extends WritableSignal<T> {
  private _value: T;

  constructor(initialValue: T) {
    super();
    this._value = initialValue;
  }

  read(): T {
    return this._value;
  }

  write(value: T): void {
    this._value = value;
  }
}

export class Computed<
  TResult,
  const TDependencies extends readonly Signal<any>[] = Signal<any>[],
> extends Signal<TResult> {
  private readonly _computation: (
    ...signals: UnwrapSignals<TDependencies>
  ) => TResult;
  private readonly _dependencies: TDependencies;
  private _memoizedResult: TResult | null;
  private _memoizedVersion;

  constructor(
    computation: (...values: UnwrapSignals<TDependencies>) => TResult,
    dependencies: TDependencies,
    initialResult: TResult | null = null,
    initialVersion = -1, // -1 indicates an uninitialized signal.
  ) {
    super();
    this._computation = computation;
    this._dependencies = dependencies;
    this._memoizedResult = initialResult;
    this._memoizedVersion = initialVersion;
  }

  get value(): TResult {
    const currentVersion = this.version;
    if (this._memoizedVersion < currentVersion) {
      const computation = this._computation;
      this._memoizedResult = computation(
        ...(this._dependencies.map(
          (dependency) => dependency.value,
        ) as UnwrapSignals<TDependencies>),
      );
      this._memoizedVersion = currentVersion;
    }
    return this._memoizedResult!;
  }

  get version(): number {
    let version = 0;
    for (const dependency of this._dependencies) {
      version += dependency.version;
    }
    return version;
  }

  subscribe(subscriber: Subscriber): Unsubscribe {
    const subscriptions = this._dependencies.map((dependency) =>
      dependency.subscribe(subscriber),
    );
    return () => {
      for (const subscription of subscriptions) {
        subscription();
      }
    };
  }
}
