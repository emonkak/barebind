import type { RenderContext } from '../core.js';
import { userHookTag } from '../hook.js';
import {
  Atom,
  Computed,
  Signal,
  type Subscriber,
  type Subscription,
} from './signal.js';

const signalAccessorsTag = Symbol('signalAccessors');

type SignalAccessors = Record<
  PropertyKey,
  ClassAccessorDecoratorTarget<unknown, Signal<any>>
>;

type SignalKeys<T> = Extract<
  Exclude<keyof T, FunctionKeys<T>>,
  WritableKeys<T>
>;

type FunctionKeys<T> = {
  [K in keyof T]: T[K] extends Function ? K : never;
}[keyof T];

type WritableKeys<T> = {
  [K in keyof T]: StrictEqual<
    { -readonly [P in K]-?: T[P] },
    Pick<T, K>
  > extends true
    ? K
    : never;
}[keyof T];

type StrictEqual<X, Y> = (<T>() => T extends X ? 1 : 2) extends <
  T,
>() => T extends Y ? 1 : 2
  ? true
  : false;

export abstract class Store {
  static [userHookTag]<T extends Store>(
    this: { new (...args: unknown[]): T },
    context: RenderContext,
  ): T {
    const store = context.getContextualValue(this);
    if (!(store instanceof this)) {
      throw new Error(
        `The contextual value for ${this.name} does not exist, please ensure it is registered by context.use(${this.name}).`,
      );
    }
    return store;
  }

  [userHookTag](context: RenderContext): void {
    context.setContextualValue(this.constructor, this);
  }

  asSignal(): StoreSignal<this> {
    return new StoreSignal(this);
  }

  getState(): Pick<this, SignalKeys<this>> {
    const signalAccessors = getSignalAccessors(this.constructor);
    const state: Partial<this> = {};
    for (const key in signalAccessors) {
      state[key as keyof this] = signalAccessors[key]!.get.call(this)
        .value as this[keyof this];
    }
    return state as Pick<this, SignalKeys<this>>;
  }

  getSignal<TKey extends SignalKeys<this>>(key: TKey): Signal<this[TKey]> {
    return getSignalAccessors(this.constructor)[key].get.call(this);
  }

  getVersion(): number {
    const signalAccessors = getSignalAccessors(this.constructor);
    let version = 0;
    for (const key in signalAccessors) {
      version += signalAccessors[key]!.get.call(this).version;
    }
    return version;
  }

  replaceState(state: Pick<this, SignalKeys<this>>): void {
    for (const key in state) {
      this[key as SignalKeys<this>] = state[key as SignalKeys<this>]!;
    }
  }

  subscribeState(subscriber: Subscriber): Subscription {
    const signalAccessors = getSignalAccessors(this.constructor);
    const subscriptions: Subscription[] = [];
    for (const key in signalAccessors) {
      const subscription =
        signalAccessors[key]!.get.call(this).subscribe(subscriber);
      subscriptions.push(subscription);
    }
    return () => {
      for (let i = 0, l = subscriptions.length; i < l; i++) {
        subscriptions[i]!();
      }
    };
  }
}

export class StoreSignal<TStore extends Store> extends Signal<TStore> {
  private readonly _store: TStore;

  constructor(store: TStore) {
    super();
    this._store = store;
  }

  get value(): TStore {
    return this._store;
  }

  get version(): number {
    return this._store.getVersion();
  }

  subscribe(subscriber: Subscriber): Subscription {
    return this._store.subscribeState(subscriber);
  }
}

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
      throw new Error('@signal can only be used on accessors or getters');
  }
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
      const signalAccessors = (context.metadata[signalAccessorsTag] ??=
        {}) as SignalAccessors;
      signalAccessors[context.name] = target as ClassAccessorDecoratorTarget<
        unknown,
        Signal<T>
      >;
      return new Atom(value) as T;
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
    const signalAccessors = (context.metadata[signalAccessorsTag] ??
      {}) as SignalAccessors;
    const dependencies: Signal<unknown>[] = [];
    let version = 0;
    const value = target.call(
      new Proxy(this, {
        get: (target, key) => {
          if (Object.hasOwn(signalAccessors, key)) {
            const signal = signalAccessors[key]!.get.call(this);
            dependencies.push(signal);
            version += signal.version;
          }
          return Reflect.get(target, key);
        },
      }),
    );
    signal = new Computed<T>(
      () => target.call(this),
      dependencies,
      value,
      version,
    );
    cachedSignals.set(this, signal);
    return value;
  };
}

function getSignalAccessors(store: Function): SignalAccessors {
  return (store[Symbol.metadata]?.[signalAccessorsTag] ??
    {}) as SignalAccessors;
}
