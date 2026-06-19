import {
  createComponent,
  type HookObject,
  type RenderContext,
} from '../../component.js';
import { type Bindable, toElement, type VElement } from '../../core.js';

export interface InvalidateEvent<T = any> {
  readonly source: Atom<T>;
  readonly path: readonly PropertyKey[];
  readonly oldValue: T;
  readonly newValue: T;
}

export type Subscriber = (event: InvalidateEvent) => void;

export type Unsubscribe = () => void;

export type UnwrapSignals<T> = {
  [K in keyof T]: T[K] extends Signal<infer Value> ? Value : never;
};

const SignalObserver = createComponent<Signal<any>>(
  function SignalObserver(signal) {
    return this.use(signal);
  },
);

export abstract class Signal<T> implements Bindable, HookObject<T> {
  abstract get value(): T;

  abstract get version(): number;

  [toElement](): VElement {
    return SignalObserver(this);
  }

  map<TResult>(
    selector: (value: T) => TResult,
  ): Computed<TResult, [Signal<T>]> {
    return new Computed<TResult, [Signal<T>]>(selector, [this]);
  }

  abstract subscribe(subscriber: Subscriber): Unsubscribe;

  onUse(context: RenderContext): T {
    const version = this.version;
    const snapshot = context.useMemo(() => ({ version }), []);

    context.useEffect(() => {
      snapshot.version = version;

      if (version < this.version) {
        context.forceUpdate();
      }
    }, [version]);

    context.useEffect(() => {
      let batched = true;
      const checkForChanges = () => {
        if (snapshot.version < this.version) {
          context.forceUpdate();
        }
        batched = false;
      };
      checkForChanges();
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

export class Atom<T> extends Signal<T> {
  private _value: T;

  private _version: number;

  private readonly _subscribers = new Set<Subscriber>();

  constructor(initialValue: T, initialVersion: number = 0) {
    super();
    this._value = initialValue;
    this._version = initialVersion;
  }

  get value(): T {
    return this._value;
  }

  set value(newValue: T) {
    const oldValue = this._value;
    if (!Object.is(oldValue, newValue)) {
      this._value = newValue;
      this.invalidate({
        source: this as Atom<unknown>,
        path: [],
        oldValue,
        newValue,
      });
    }
  }

  get version(): number {
    return this._version;
  }

  invalidate(event: InvalidateEvent): void {
    this._version += 1;
    for (const subscriber of this._subscribers) {
      subscriber(event);
    }
  }

  subscribe(subscriber: Subscriber): Unsubscribe {
    this._subscribers.add(subscriber);
    return () => {
      this._subscribers.delete(subscriber);
    };
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
    initialVersion = -1, // -1 is indicated an uninitialized signal.
  ) {
    super();
    this._computation = computation;
    this._dependencies = dependencies;
    this._memoizedResult = initialResult;
    this._memoizedVersion = initialVersion;
  }

  get value(): TResult {
    const version = this.version;

    if (this._memoizedVersion < version) {
      const computation = this._computation;
      this._memoizedResult = computation(
        ...(this._dependencies.map(
          (dependency) => dependency.value,
        ) as UnwrapSignals<TDependencies>),
      );
      this._memoizedVersion = version;
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
