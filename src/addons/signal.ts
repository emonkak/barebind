import {
  $hook,
  $toDirective,
  type Bindable,
  type Binding,
  type Coroutine,
  DETACHED_SCOPE,
  type Directive,
  type DirectiveContext,
  type DirectiveType,
  type HookFunction,
  type HookObject,
  Lanes,
  type Part,
  type RenderContext,
  type Scope,
  type SessionContext,
  type Slot,
  type UpdateSession,
} from '../internal.js';
import { LinkedList } from '../linked-list.js';

export interface InvalidateEvent<T = unknown> {
  readonly source: Atom<T>;
  readonly reversePath: readonly PropertyKey[];
  readonly newValue: T;
  readonly oldValue: T;
}

export type Subscriber<T = unknown> = (event: InvalidateEvent<T>) => void;

export type Subscription = () => void;

export type UnwrapSignals<T> = {
  [K in keyof T]: T[K] extends Signal<infer Value> ? Value : never;
};

/**
 * @internal
 */
export const SignalDirective: DirectiveType<Signal<any>> = {
  displayName: 'SignalDirective',
  resolveBinding(
    signal: Signal<unknown>,
    part: Part,
    context: DirectiveContext,
  ): SignalBinding<unknown> {
    const slot = context.resolveSlot(signal.value, part);
    return new SignalBinding(signal, slot);
  },
};

/**
 * @internal
 */
export class SignalBinding<T> implements Binding<Signal<T>>, Coroutine {
  private _signal: Signal<T>;

  private _version: number;

  private readonly _slot: Slot<T>;

  private _scope: Scope = DETACHED_SCOPE;

  private _pendingLanes: Lanes = Lanes.NoLanes;

  private _subscription: Subscription | null = null;

  constructor(signal: Signal<T>, slot: Slot<T>) {
    this._signal = signal;
    this._version = signal.version;
    this._slot = slot;
  }

  get type(): DirectiveType<Signal<T>> {
    return SignalDirective;
  }

  get value(): Signal<T> {
    return this._signal;
  }

  set value(signal: Signal<T>) {
    this._signal = signal;
    this._version = -1;
  }

  get part(): Part {
    return this._slot.part;
  }

  get scope(): Scope {
    return this._scope;
  }

  get pendingLanes(): Lanes {
    return this._pendingLanes;
  }

  resume(session: UpdateSession): void {
    if (this._slot.reconcile(this._signal.value, session)) {
      session.frame.mutationEffects.push(this._slot, this._scope.level);
    }
    this._pendingLanes = Lanes.NoLanes;
  }

  shouldUpdate(signal: Signal<T>): boolean {
    return this._subscription === null || signal !== this._signal;
  }

  attach(session: UpdateSession): void {
    const { scope, context } = session;
    const { version } = this._signal;

    this._subscription?.();

    if (this._version < version) {
      this._slot.reconcile(this._signal.value, session);
      this._version = version;
    } else {
      this._slot.attach(session);
    }

    this._scope = scope;
    this._subscription = this._subscribeSignal(context);
  }

  detach(session: UpdateSession): void {
    this._subscription?.();
    this._slot.detach(session);

    this._scope = DETACHED_SCOPE;
    this._subscription = null;
  }

  commit(): void {
    this._slot.commit();
  }

  rollback(): void {
    this._slot.rollback();
  }

  private _subscribeSignal(context: SessionContext): Subscription {
    return this._signal.subscribe(() => {
      const { lanes } = context.scheduleUpdate(this);
      this._pendingLanes |= lanes;
    });
  }
}

export abstract class Signal<T> implements HookObject<T>, Bindable<Signal<T>> {
  abstract get value(): T;

  abstract get version(): number;

  [$hook](context: RenderContext): T {
    const value = this.value;
    const snapshot = context.useRef(value);

    context.useLayoutEffect(() => {
      snapshot.current = value;
    }, [value]);

    context.useEffect(() => {
      // The guard for batch updates with microtasks.
      let guard = true;
      const checkForChanges = () => {
        if (!Object.is(this.value, snapshot.current)) {
          context.forceUpdate();
        }
        guard = false;
      };
      queueMicrotask(checkForChanges);
      return this.subscribe(() => {
        if (!guard) {
          guard = true;
          queueMicrotask(checkForChanges);
        }
      });
    }, [this]);

    return value;
  }

  [$toDirective](): Directive<Signal<T>> {
    return { type: SignalDirective, value: this };
  }

  abstract subscribe(subscriber: Subscriber): Subscription;

  map<TResult>(selector: (value: T) => TResult): Signal<TResult> {
    return new Computed<TResult, [Signal<T>]>(selector, [this]);
  }

  valueOf(): T {
    return this.value;
  }
}

export class Atom<T> extends Signal<T> {
  private _value: T;

  private _version: number;

  private _subscribers = new LinkedList<Subscriber>();

  constructor(initialValue: T);
  /**
   * @internal
   */
  constructor(initialValue: T, initialVersion: number);
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
    this._value = newValue;
    this.invalidate({
      source: this,
      reversePath: [],
      newValue,
      oldValue,
    });
  }

  get version(): number {
    return this._version;
  }

  invalidate(event: InvalidateEvent): void {
    this._version += 1;
    for (
      let node = this._subscribers.front();
      node !== null;
      node = node.next
    ) {
      const subscriber = node.value;
      subscriber(event);
    }
  }

  poke(value: T): void {
    this._value = value;
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
  );
  /**
   * @internal
   */
  constructor(
    computation: (...values: UnwrapSignals<TDependencies>) => TResult,
    dependencies: TDependencies,
    initialResult: TResult,
    initialVersion: number,
  );
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

  subscribe(subscriber: Subscriber): Subscription {
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

export function LocalAtom<T>(initialValue: T): HookFunction<Atom<T>> {
  return (context) => {
    return context.useMemo(() => new Atom(initialValue), []);
  };
}

export function LocalComputed<
  TResult,
  const TDependencies extends readonly Signal<any>[],
>(
  computation: (...values: UnwrapSignals<TDependencies>) => TResult,
  dependencies: TDependencies,
): HookFunction<Computed<TResult, TDependencies>> {
  return (context) => {
    return context.useMemo(
      () => new Computed(computation, dependencies),
      dependencies,
    );
  };
}
