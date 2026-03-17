import { LinkedList } from '../../collections/linked-list.js';
import {
  $directive,
  $hook,
  type Bindable,
  type Binding,
  type Coroutine,
  DETACHED_SCOPE,
  type Directive,
  type DirectiveContext,
  type DirectiveType,
  type Effect,
  type HookObject,
  Lane,
  type Lanes,
  type Part,
  type RenderContext,
  type Scope,
  type Slot,
  type UpdateSession,
} from '../../core.js';

export interface InvalidateEvent<T = unknown> {
  readonly source: Atom<T>;
  readonly path: readonly PropertyKey[];
  readonly newValue: T;
  readonly oldValue: T;
}

export type Subscriber = (event: InvalidateEvent) => void;

export type Unsubscribe = () => void;

export type UnwrapSignals<T> = {
  [K in keyof T]: T[K] extends Signal<infer Value> ? Value : never;
};

interface Subscription {
  unsubscribe: Unsubscribe | null;
}

export const SignalDirective: DirectiveType<Signal<any>> = {
  name: 'SignalDirective',
  resolveBinding(
    signal: Signal<unknown>,
    part: Part,
    context: DirectiveContext,
  ): SignalBinding<unknown> {
    const slot = context.resolveSlot(signal.value, part);
    return new SignalBinding(signal, slot);
  },
};

export class SignalBinding<T> implements Binding<Signal<T>>, Coroutine {
  pendingLanes: Lanes = Lane.NoLane;

  private _signal: Signal<T>;

  private readonly _slot: Slot<T>;

  private _memoizedVersion: number;

  private _scope: Scope = DETACHED_SCOPE;

  private _subscription: Subscription = {
    unsubscribe: null,
  };

  constructor(signal: Signal<T>, slot: Slot<T>) {
    this._signal = signal;
    this._slot = slot;
    this._memoizedVersion = signal.version;
  }

  get type(): DirectiveType<Signal<T>> {
    return SignalDirective;
  }

  get value(): Signal<T> {
    return this._signal;
  }

  set value(signal: Signal<T>) {
    this._signal = signal;
    this._memoizedVersion = -1;
  }

  get part(): Part {
    return this._slot.part;
  }

  get name(): string {
    return Signal.name;
  }

  get scope(): Scope {
    return this._scope;
  }

  resume(session: UpdateSession): void {
    if (this._slot.reconcile(this._signal.value, session)) {
      session.frame.mutationEffects.push(this._slot, this._scope.level);
    }
  }

  shouldUpdate(signal: Signal<T>): boolean {
    return this._subscription.unsubscribe === null || signal !== this._signal;
  }

  attach(session: UpdateSession): void {
    const { frame, scope, context } = session;
    const { version } = this._signal;

    frame.layoutEffects.push(
      new SubscribeSignal(this._signal, this._subscription, () => {
        context.scheduleUpdate(this);
      }),
      scope.level,
    );

    if (this._memoizedVersion < version) {
      this._slot.reconcile(this._signal.value, session);
      this._memoizedVersion = version;
    } else {
      this._slot.attach(session);
    }

    this._scope = scope;
  }

  detach(session: UpdateSession): void {
    const { frame } = session;

    frame.layoutEffects.pushBefore(new UnsubscribeSignal(this._subscription));

    this._slot.detach(session);
  }

  commit(): void {
    this._slot.commit();
  }

  rollback(): void {
    this._slot.rollback();
    this._scope = DETACHED_SCOPE;
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

  [$directive](): Directive<Signal<T>> {
    return { type: SignalDirective, value: this };
  }

  abstract subscribe(subscriber: Subscriber): Unsubscribe;

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
      path: [],
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

  subscribe(subscriber: Subscriber): Unsubscribe {
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

class SubscribeSignal<T> implements Effect {
  private readonly _signal: Signal<T>;

  private readonly _subscription: Subscription;

  private readonly _subscriber: Subscriber;

  constructor(
    signal: Signal<T>,
    subscription: Subscription,
    subscriber: Subscriber,
  ) {
    this._signal = signal;
    this._subscription = subscription;
    this._subscriber = subscriber;
  }

  commit(): void {
    this._subscription.unsubscribe?.();
    this._subscription.unsubscribe = this._signal.subscribe(this._subscriber);
  }
}

class UnsubscribeSignal implements Effect {
  private readonly _subscription: Subscription;

  constructor(subscription: Subscription) {
    this._subscription = subscription;
  }

  commit(): void {
    this._subscription.unsubscribe?.();
  }
}
