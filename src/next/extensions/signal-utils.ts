import {
  Atom,
  Computed,
  type Signal,
  type Subscriber,
  type Subscription,
} from './signal.js';

const signalAccesorsTag = Symbol('signalAccesors');

export type Snapshot<T> = {
  [K in keyof T]: T[K] extends Signal<unknown> ? T[K] : never;
};

type SignalAccesors = Record<
  PropertyKey,
  ClassAccessorDecoratorTarget<unknown, Signal<any>>
>;

export function signal<T>(
  target: ClassAccessorDecoratorTarget<unknown, T>,
  context: ClassAccessorDecoratorContext<unknown, T>,
): ReturnType<typeof atomDecorator<T>>;
export function signal<T>(
  target: () => T,
  context: ClassGetterDecoratorContext<unknown, T>,
): ReturnType<typeof computedDecorator<T>>;
export function signal<T>(
  target: ClassAccessorDecoratorTarget<unknown, T> | (() => T),
  context: DecoratorContext,
) {
  switch (context.kind) {
    case 'accessor':
      return atomDecorator(
        target as ClassAccessorDecoratorTarget<unknown, T>,
        context,
      );
    case 'getter':
      return computedDecorator(target as () => T, context);
    default:
      throw new Error(`@signal can only be used on accessors or getters`);
  }
}

export function getSnapshot<T extends object>(store: T): Snapshot<T> {
  const signalAccesors = (store.constructor[Symbol.metadata]?.[
    signalAccesorsTag
  ] ?? {}) as SignalAccesors;
  const snapshot: Partial<Snapshot<T>> = {};
  for (const key in signalAccesors) {
    snapshot[key as keyof T] = signalAccesors[key]!.get.call(store) as any;
  }
  return snapshot as Snapshot<T>;
}

export function restoreSnapshot<T extends object>(
  store: T,
  snapshot: Snapshot<T>,
): void {
  for (const key in snapshot) {
    store[key as keyof T] = snapshot[key];
  }
}

export function subscribeStore(
  store: object,
  subscriber: Subscriber,
): Subscription {
  const signalAccesors = (store.constructor[Symbol.metadata]?.[
    signalAccesorsTag
  ] ?? {}) as SignalAccesors;
  const subscriptions: Subscription[] = [];
  for (const key in signalAccesors) {
    const subscription =
      signalAccesors[key]!.get.call(store).subscribe(subscriber);
    subscriptions.push(subscription);
  }
  return () => {
    for (let i = 0, l = subscriptions.length; i < l; i++) {
      subscriptions[i]!();
    }
  };
}

function atomDecorator<T>(
  target: ClassAccessorDecoratorTarget<unknown, T>,
  context: ClassAccessorDecoratorContext,
): ClassAccessorDecoratorResult<unknown, T> {
  const { get } = target;

  return {
    get(): T {
      return (get.call(this) as Atom<T>).value;
    },
    set(value: T): void {
      (get.call(this) as Atom<T>).value = value;
    },
    init(value: T): T {
      const signal = new Atom(value);
      const signalAccesors = (context.metadata[signalAccesorsTag] ??=
        {}) as SignalAccesors;
      signalAccesors[context.name] = target as ClassAccessorDecoratorTarget<
        unknown,
        Signal<T>
      >;
      return signal as unknown as T;
    },
  };
}

function computedDecorator<T>(
  target: () => T,
  context: ClassGetterDecoratorContext,
): () => T {
  const cachedSignals = new WeakMap<object, Computed<T>>();

  return function (this: object) {
    let signal = cachedSignals.get(this);
    if (signal !== undefined) {
      return signal.value;
    }
    const dependencies: Signal<unknown>[] = [];
    const signalAccesors = (context.metadata[signalAccesorsTag] ??
      {}) as SignalAccesors;
    const value = target.call(
      new Proxy(this, {
        get: (target, key) => {
          if (Object.hasOwn(signalAccesors, key)) {
            dependencies.push(signalAccesors[key]!.get.call(this));
          }
          return Reflect.get(target, key);
        },
      }),
    );
    signal = new Computed<T>(() => target.call(this), dependencies);
    cachedSignals.set(this as object, signal);
    return value;
  };
}
